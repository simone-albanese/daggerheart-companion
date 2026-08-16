/**
 * The compact character codec.
 *
 * This payload is the QR vector. A transfer too big for a comfortable QR is
 * offered as a file instead, and that file is JSON with its own envelope
 * (`fileIo.ts`) rather than these bytes - so `frames.ts` is the only thing in
 * `src` that calls either function here. The shape is the one Architecture 5.2
 * asks for:
 *
 *   1. a binary body - every Ref is a varint from the registry, every piece of
 *      free text is UTF-8 behind a varint length
 *   2. raw deflate, applied only when it actually shrinks the body, with a bit
 *      in the header either way
 *   3. a crc32 of the payload, inside the payload
 *
 *   format 2 (written)   byte 0     version in the low nibble, 0x80 when deflated
 *                        bytes 1-4  crc32, big-endian, over this whole payload
 *                                   with these four bytes zeroed
 *                        bytes 5..  the body, field by field in `writeBody`
 *   format 1 (read only) byte 0     the same header, bytes 1.. the body
 *
 * WHY THE CHECKSUM IS HERE AND NOT ONLY ONE LAYER UP. Measured: 8136 single-bit
 * flips across 15 real sheets, and 30.9 % of them decoded into a *different*
 * character with no complaint - a different weapon, a different scar, a
 * different level-up record. Structure catches most corruption and cannot catch
 * all of it, because a flip inside a number leaves every length intact. The
 * frame header's crc32 did close that for the two receive surfaces this app
 * ships, but it closed it for them and not for the format: verification there
 * is the caller's option, and anything that ever feeds bytes in from somewhere
 * else - a pasted code, a Bluetooth hand-off - would have inherited nothing.
 * A format whose own bytes say whether they arrived intact cannot be adopted
 * wrongly.
 *
 * THREE DELIBERATE LOSSES. The first two are of local handles rather than of
 * content; the third is of a count, and it is the only one a player can notice:
 *
 *   - `Experience.id` is not carried. It is a React key, meaningless off this
 *     device, and three of them would cost 48 bytes - a third of the whole
 *     payload. The decoder mints fresh ids and re-points the level-up records
 *     that referred to them, so the sheet is identical in every way that a
 *     player or the engine can observe.
 *   - a level-up's trait pair is stored in the order it was picked, but the
 *     rules treat it as a set; anything the compact encoding cannot express
 *     exactly escapes to JSON instead of being approximated.
 *   - `consecutiveShortRests` is not carried, and decodes as 0. It is one
 *     varint in 0..3 and its cost is not the byte: putting it on the wire
 *     needs a new format number, and the next one is 3. `adversarial.test.ts`
 *     pins that no single-bit flip of the version nibble can land on another
 *     readable format - from 2 the four flips give 3, 0, 6 and 10 - and from
 *     3 they give 2 and 1, both readable and one of them the format that
 *     carries no checksum. A count of rests is not worth trading that
 *     property, nor worth breaking receipt by every phone that has not
 *     updated yet, which is the direction this vector exists for. If a later
 *     item does want it on the wire, the format number to take is 4.
 *
 * What that costs, said plainly rather than left to be discovered: a sheet
 * handed over by QR arrives having counted no rests, so the receiving device
 * may offer a short rest the sending table already spent. The `.dhchar` and
 * `.dhbackup` paths carry it exactly, and any screen that shows the count owes
 * the reader the difference between "none counted" and "none taken".
 *
 * Everything else round-trips exactly, including `unresolvedRefs`: a device
 * that could not name a card still forwards its id intact, so passing a sheet
 * through a phone with an older dataset does not erode it.
 */
import {
  DOMAINS,
  RANGES,
  SCHEMA_VERSION,
  TRAITS,
  type AdvancementKind,
  type Character,
  type CompanionState,
  type Counter,
  type DomainId,
  type Experience,
  type InventoryEntry,
  type LevelUpChoice,
  type Range,
  type Ref,
  type Trait,
} from '../../shared/types.ts';
import { COUNTER_CEILINGS, type CounterName } from '../engine/character.ts';
import { crc32 } from './crc32.ts';
import {
  isReserved,
  isUnresolvedRef,
  unresolvedIdOf,
  unresolvedRef,
  type Registry,
} from './registry.ts';

/** What this build writes. */
export const CODEC_VERSION = 2;

/**
 * Every format this build can read, oldest first.
 *
 * 1 is read and never written. The old-phone-to-new-phone hand-off is the case
 * this whole vector exists for, and in it the *sender* is the older build -
 * `UpdateBanner` deliberately leaves a stale bundle in charge until the user
 * accepts, so "both devices are current" is not something a receiver may
 * assume. Refusing 1 would break the transfer exactly when it is the only thing
 * standing between a player and their months of play. What a format-1 payload
 * does not carry is a checksum of its own; on the QR vector the frame header's
 * crc32 covers it, and `adversarial.test.ts` says so out loud rather than
 * letting the reader assume otherwise.
 */
export const READABLE_CODEC_VERSIONS = [1, 2] as const;

const VERSION_MASK = 0x0f;
const DEFLATED_BIT = 0x80;
/** Bytes 1-4 of a format-2 payload. */
const CHECKSUM_BYTES = 4;
const BODY_AT: Record<number, number> = { 1: 1, 2: 1 + CHECKSUM_BYTES };

export class CodecError extends Error {
  override name = 'CodecError';
}

/** Thrown by the encoder: a slug with no registry id cannot go on the wire. */
export class UnknownSlugError extends CodecError {
  override name = 'UnknownSlugError';
  constructor(readonly slugs: string[]) {
    super(
      `${slugs.length} reference${slugs.length === 1 ? ' is' : 's are'} missing from the id registry, ` +
        `so this character cannot be sent as a QR code: ${slugs.join(', ')}. ` +
        `Export a .dhchar file instead - it carries slugs and needs no registry.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

class Writer {
  private buf = new Uint8Array(512);
  private len = 0;

  private room(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  u8(value: number): void {
    this.room(1);
    this.buf[this.len++] = value & 0xff;
  }

  /** LEB128. Division rather than shifts, so timestamps past 2^31 survive. */
  varint(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new CodecError(`Cannot encode ${String(value)} as a varint.`);
    }
    let v = value;
    while (v >= 0x80) {
      this.u8((v % 0x80) + 0x80);
      v = Math.floor(v / 0x80);
    }
    this.u8(v);
  }

  /** Zigzag: small negatives cost one byte, like small positives. */
  zigzag(value: number): void {
    if (!Number.isSafeInteger(value)) throw new CodecError(`Cannot encode ${String(value)}.`);
    this.varint(value >= 0 ? value * 2 : -value * 2 - 1);
  }

  bytes(b: Uint8Array): void {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  str(s: string): void {
    const b = utf8.encode(s);
    this.varint(b.length);
    this.bytes(b);
  }

  done(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

class Reader {
  private at = 0;
  constructor(private readonly buf: Uint8Array) {}

  private take(n: number): number {
    if (this.at + n > this.buf.length) {
      throw new CodecError('The transfer ended early - it is incomplete or damaged.');
    }
    const from = this.at;
    this.at += n;
    return from;
  }

  u8(): number {
    return this.buf[this.take(1)]!;
  }

  varint(): number {
    let value = 0;
    let scale = 1;
    for (;;) {
      const byte = this.u8();
      value += (byte & 0x7f) * scale;
      if ((byte & 0x80) === 0) return value;
      scale *= 0x80;
      if (scale > Number.MAX_SAFE_INTEGER) {
        throw new CodecError('Malformed varint in the transfer.');
      }
    }
  }

  zigzag(): number {
    const n = this.varint();
    return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
  }

  bytes(n: number): Uint8Array {
    return this.buf.subarray(this.take(n), this.at);
  }

  str(): string {
    const b = this.bytes(this.varint());
    try {
      return utf8Decoder.decode(b);
    } catch {
      throw new CodecError('The transfer contains text that is not valid UTF-8.');
    }
  }

  /** Optional text: 0 is "the key was absent", n+1 is a string of n bytes. */
  maybeStr(): string | undefined {
    const n = this.varint();
    if (n === 0) return undefined;
    const b = this.bytes(n - 1);
    try {
      return utf8Decoder.decode(b);
    } catch {
      throw new CodecError('The transfer contains text that is not valid UTF-8.');
    }
  }

  get remaining(): number {
    return this.buf.length - this.at;
  }
}

// ---------------------------------------------------------------------------
// Deflate
// ---------------------------------------------------------------------------

async function pipe(bytes: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const out = await new Response(source.pipeThrough(transform)).arrayBuffer();
  return new Uint8Array(out);
}

/** Null when the browser has no CompressionStream: the flag bit then stays clear. */
async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    return await pipe(bytes, new CompressionStream('deflate-raw'));
  } catch {
    return null;
  }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new CodecError('This transfer is compressed and this browser cannot decompress it.');
  }
  try {
    return await pipe(bytes, new DecompressionStream('deflate-raw'));
  } catch {
    throw new CodecError('The transfer is damaged: it did not decompress.');
  }
}

// ---------------------------------------------------------------------------
// Small shared encodings
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ID_NONE = 0;
const ID_UUID = 1;
const ID_STRING = 2;

const WHEN_NONE = 0;
const WHEN_EPOCH_MS = 1;
const WHEN_STRING = 2;

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToUuid(b: Uint8Array): string {
  const hex = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** ISO timestamps are the common case and cost six bytes as epoch milliseconds. */
function writeWhen(w: Writer, iso: string | undefined): void {
  if (iso === undefined || iso === '') {
    w.u8(WHEN_NONE);
    return;
  }
  const ms = Date.parse(iso);
  if (Number.isFinite(ms) && ms >= 0 && new Date(ms).toISOString() === iso) {
    w.u8(WHEN_EPOCH_MS);
    w.varint(ms);
    return;
  }
  w.u8(WHEN_STRING);
  w.str(iso);
}

function readWhen(r: Reader): string {
  const tag = r.u8();
  if (tag === WHEN_NONE) return '';
  if (tag === WHEN_EPOCH_MS) return new Date(r.varint()).toISOString();
  if (tag === WHEN_STRING) return r.str();
  throw new CodecError(`Unknown timestamp tag ${tag} in the transfer.`);
}

const writeCounter = (w: Writer, c: Counter): void => {
  w.varint(Math.max(0, Math.trunc(c.marked)));
  w.varint(Math.max(0, Math.trunc(c.max)));
};

/**
 * A counter, refused rather than believed when it is past the rules' ceiling.
 *
 * Every other count-driven loop in this decoder is self-limiting: a declared
 * count of 2^50 experiences has to be followed by 2^50 strings, and the reader
 * runs off the end of the buffer and throws long before it allocates anything.
 * That is deliberate, and it is what makes this the one hole worth naming - a
 * counter maximum drives no loop *here*, so a payload could declare `hp.max` of
 * 2^20 and cost the decoder nothing at all, and then cost `Track.tsx` a million
 * DOM nodes when the sheet is drawn.
 *
 * Bounded rather than clamped, and that is not the same choice the store makes
 * three lines further along the same journey. This file's stated rule is that
 * anything the compact form cannot express exactly escapes rather than being
 * approximated, and reading a plausible character out of a damaged payload is
 * the one outcome it exists to avoid. A silently clamped `hp.max` is a
 * plausible character read out of a damaged payload. The ceilings come from the
 * engine rather than from a number invented here, so the codec and the sheet
 * cannot come to disagree about what a legal track is.
 */
function readCounter(r: Reader, track: CounterName, label: string): Counter {
  const ceiling = COUNTER_CEILINGS[track];
  const marked = r.varint();
  const max = r.varint();
  const refuse = (what: string, value: number): never => {
    throw new CodecError(
      `This transfer says the ${label} track has ${what} of ${value}, and ${ceiling} is the most the rules allow. ` +
        'It is damaged or was not written by this app, so nothing has been imported.',
    );
  };
  if (max > ceiling) refuse('a maximum', max);
  if (marked > ceiling) refuse('a marked count', marked);
  return { marked, max };
}

/** Optional list length: 0 means the key was absent, n+1 means a list of n. */
const writeMaybeCount = (w: Writer, list: readonly unknown[] | undefined): void =>
  w.varint(list === undefined ? 0 : list.length + 1);

/**
 * Optional text, same trick and the same one byte a bare length costs: an
 * absent note and an empty one are different states of the sheet, and the
 * codec is not allowed to quietly pick one.
 */
function writeMaybeStr(w: Writer, s: string | undefined): void {
  if (s === undefined) {
    w.varint(0);
    return;
  }
  const b = utf8.encode(s);
  w.varint(b.length + 1);
  w.bytes(b);
}

// Advancement kinds ride as a nibble; the option id is derivable from the kind,
// so `applyLevelUp`'s two bookkeeping keys cost nothing on the wire.
const ADVANCEMENT_KINDS: readonly AdvancementKind[] = [
  'trait',
  'hitPoint',
  'stress',
  'experience',
  'domainCard',
  'evasion',
  'subclass',
  'proficiency',
  'multiclass',
];

const OPTION_ID_FOR_KIND: Record<AdvancementKind, string> = {
  trait: 'traits',
  hitPoint: 'hit-point',
  stress: 'stress',
  experience: 'experience',
  domainCard: 'domain-card',
  evasion: 'evasion',
  subclass: 'subclass',
  proficiency: 'proficiency',
  multiclass: 'multiclass',
};

/** Head nibble for a level-up record the compact form cannot express exactly. */
const ESCAPED_CHOICE = 0x0f;
const NO_TIER = 3;

/** Detail keys each kind writes itself. Anything else rides in the extras block. */
const CONSUMED_KEYS: Record<AdvancementKind, readonly string[]> = {
  trait: ['traits'],
  hitPoint: [],
  stress: [],
  experience: ['experiences'],
  domainCard: ['cardRef'],
  evasion: [],
  subclass: ['subclassRef'],
  proficiency: [],
  multiclass: ['classRef', 'domain', 'subclassRef'],
};

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

export interface EncodeOptions {
  /**
   * Carry the character's own id and timestamps. On by default: it is what
   * lets the receiving device update the same sheet instead of cloning it.
   */
  identity?: boolean;
  /** Off only to measure the raw body; the flag bit records what was done. */
  compress?: boolean;
}

class RefWriter {
  readonly missing = new Set<string>();
  constructor(
    private readonly w: Writer,
    private readonly registry: Registry,
  ) {}

  /** 0 means "no reference". Unknown slugs are collected and thrown together. */
  write(ref: Ref | null | undefined): void {
    if (ref === null || ref === undefined || ref === '') {
      this.w.varint(0);
      return;
    }
    const parked = unresolvedIdOf(ref);
    if (parked !== null) {
      // Forwarding an id this device could not name. Still a valid reference.
      this.w.varint(parked);
      return;
    }
    const id = this.registry.idOf(ref);
    if (id === null) {
      this.missing.add(ref);
      this.w.varint(0);
      return;
    }
    this.w.varint(id);
  }

  list(refs: readonly Ref[] | undefined): void {
    writeMaybeCount(this.w, refs);
    for (const ref of refs ?? []) this.write(ref);
  }
}

function writeBody(c: Character, registry: Registry, options: EncodeOptions): Uint8Array {
  const w = new Writer();
  const refs = new RefWriter(w, registry);

  // -- identity -------------------------------------------------------------
  if (options.identity === false) {
    w.u8(ID_NONE);
  } else if (UUID_RE.test(c.id)) {
    w.u8(ID_UUID);
    w.bytes(uuidToBytes(c.id));
  } else {
    w.u8(ID_STRING);
    w.str(c.id);
  }
  if (options.identity !== false) {
    writeWhen(w, c.createdAt);
    writeWhen(w, c.updatedAt);
  }

  // -- who they are ---------------------------------------------------------
  w.str(c.name);
  w.str(c.pronouns);
  refs.write(c.classRef);
  refs.list(c.subclassRefs);
  refs.list(c.ancestryRefs);
  refs.write(c.communityRef);
  refs.write(c.multiclassRef);
  w.u8(c.multiclassDomain === null ? 0 : DOMAINS.indexOf(c.multiclassDomain) + 1);

  // -- numbers --------------------------------------------------------------
  w.varint(c.level);
  for (const t of TRAITS) w.zigzag(c.traits[t] ?? 0);
  const marks = TRAITS.filter((t) => c.traitMarks[t] !== undefined);
  w.varint(marks.length);
  for (const t of marks) {
    w.u8(TRAITS.indexOf(t));
    w.varint(c.traitMarks[t]!);
  }
  writeCounter(w, c.hp);
  writeCounter(w, c.stress);
  writeCounter(w, c.hope);
  writeCounter(w, c.armorSlots);
  w.u8(c.evasionOverride === null ? 0 : 1);
  if (c.evasionOverride !== null) w.zigzag(c.evasionOverride);
  w.u8(c.thresholdOverride === null ? 0 : 1);
  if (c.thresholdOverride !== null) {
    w.zigzag(c.thresholdOverride[0]);
    w.zigzag(c.thresholdOverride[1]);
  }

  // -- cards and gear -------------------------------------------------------
  refs.list(c.loadout);
  refs.list(c.vault);
  refs.write(c.activePrimaryWeapon);
  refs.write(c.activeSecondaryWeapon);
  refs.write(c.activeArmor);

  w.varint(c.inventory.length);
  for (const entry of c.inventory) {
    refs.write(entry.ref);
    w.str(entry.name);
    w.varint(Math.max(0, Math.trunc(entry.quantity)));
    writeMaybeStr(w, entry.note);
  }

  // -- the sheet's own words ------------------------------------------------
  w.varint(c.experiences.length);
  for (const e of c.experiences) {
    w.str(e.name);
    w.zigzag(e.bonus);
  }
  w.varint(c.gold.handfuls);
  w.varint(c.gold.bags);
  w.varint(c.gold.chests);
  w.varint(c.connections.length);
  for (const line of c.connections) w.str(line);
  w.str(c.notes);
  w.varint(c.scars.length);
  for (const scar of c.scars) w.str(scar);

  // -- history --------------------------------------------------------------
  const experienceIndex = new Map(c.experiences.map((e, i) => [e.id, i]));
  w.varint(c.levelUpHistory.length);
  for (const choice of c.levelUpHistory) writeChoice(w, refs, choice, experienceIndex);

  // -- companion and beastform ---------------------------------------------
  w.u8(c.companion === null ? 0 : 1);
  if (c.companion !== null) writeCompanion(w, c.companion);
  w.u8(c.beastform === null ? 0 : 1);
  if (c.beastform !== null) {
    refs.write(c.beastform.ref);
    writeWhen(w, c.beastform.activatedAt);
  }

  // -- references this device already could not name ------------------------
  const parked = c.unresolvedRefs ?? [];
  w.varint(parked.length);
  for (const id of parked) w.varint(id);

  if (refs.missing.size > 0) throw new UnknownSlugError([...refs.missing].sort());
  return w.done();
}

function writeCompanion(w: Writer, companion: CompanionState): void {
  w.str(companion.name);
  w.str(companion.description);
  w.zigzag(companion.evasion);
  writeCounter(w, companion.stress);
  w.str(companion.damage);
  w.u8(RANGES.indexOf(companion.range) + 1);
  w.varint(companion.experiences.length);
  for (const e of companion.experiences) {
    w.str(e.name);
    w.zigzag(e.bonus);
  }
  w.varint(companion.upgrades.length);
  for (const u of companion.upgrades) w.str(u);
}

function readCompanion(r: Reader): CompanionState {
  const name = r.str();
  const description = r.str();
  const evasion = r.zigzag();
  const stress = readCounter(r, 'companionStress', 'companion Stress');
  const damage = r.str();
  const rangeIndex = r.u8();
  const range: Range = RANGES[rangeIndex - 1] ?? 'Melee';
  const experiences: Experience[] = [];
  for (let n = r.varint(); n > 0; n--) {
    experiences.push({ id: crypto.randomUUID(), name: r.str(), bonus: r.zigzag() });
  }
  const upgrades: string[] = [];
  for (let n = r.varint(); n > 0; n--) upgrades.push(r.str());
  return { name, description, evasion, stress, damage, range, experiences, upgrades };
}

/**
 * Whether the kind's own keys hold exactly the shapes the compact form can
 * express. A `null` where a ref belongs, a trait name the vocabulary does not
 * know, a domain from a future book: all of them escape to JSON instead of
 * being quietly rounded off.
 */
function detailFitsCompactly(kind: AdvancementKind, detail: Record<string, unknown>): boolean {
  const refLike = (value: unknown): boolean =>
    value === undefined || (typeof value === 'string' && value !== '');
  switch (kind) {
    case 'trait': {
      const traits = detail['traits'];
      if (traits === undefined) return true;
      return Array.isArray(traits) && traits.every((t) => TRAITS.includes(t as Trait));
    }
    case 'experience': {
      const ids = detail['experiences'];
      if (ids === undefined) return true;
      return Array.isArray(ids) && ids.every((id) => typeof id === 'string');
    }
    case 'domainCard':
      return refLike(detail['cardRef']);
    case 'subclass':
      return refLike(detail['subclassRef']);
    case 'multiclass': {
      const domain = detail['domain'];
      const domainOk = domain === undefined || DOMAINS.includes(domain as DomainId);
      return domainOk && refLike(detail['classRef']) && refLike(detail['subclassRef']);
    }
    default:
      return true;
  }
}

/**
 * A level-up record. `kind`, `slot` and `optionTier` share the head byte; the
 * detail follows in a shape chosen by the kind. Anything unexpected - a hand
 * made history, a future advancement - escapes to JSON rather than being
 * silently reshaped.
 */
function writeChoice(
  w: Writer,
  refs: RefWriter,
  choice: LevelUpChoice,
  experienceIndex: ReadonlyMap<string, number>,
): void {
  const kindIndex = ADVANCEMENT_KINDS.indexOf(choice.kind);
  const detail = choice.detail ?? {};
  const tier = detail['optionTier'];
  const tierBits =
    tier === undefined ? NO_TIER : typeof tier === 'number' && tier >= 2 && tier <= 4 ? tier - 2 : -1;

  const compact =
    kindIndex >= 0 &&
    tierBits >= 0 &&
    (choice.slot === 0 || choice.slot === 1) &&
    Number.isSafeInteger(choice.level) &&
    choice.level >= 0 &&
    detail['optionId'] === OPTION_ID_FOR_KIND[choice.kind] &&
    detailFitsCompactly(choice.kind, detail);

  if (!compact) {
    w.u8(ESCAPED_CHOICE);
    w.str(choice.kind);
    w.zigzag(choice.level);
    w.zigzag(choice.slot);
    w.str(JSON.stringify(detail));
    return;
  }

  // The keys a kind consumes depend only on the kind, so the extras flag is
  // known before the head byte goes out and nothing needs a scratch buffer.
  const consumed = new Set(['optionId', 'optionTier', ...CONSUMED_KEYS[choice.kind]]);
  const extras = Object.entries(detail).filter(
    ([key, value]) => !consumed.has(key) && value !== undefined,
  );
  const asRef = (value: unknown): Ref | null => (typeof value === 'string' ? value : null);

  w.u8(kindIndex | (tierBits << 4) | ((choice.slot & 1) << 6) | (extras.length > 0 ? 0x80 : 0));
  w.varint(choice.level);

  switch (choice.kind) {
    case 'trait': {
      const traits = detail['traits'] as Trait[] | undefined;
      writeMaybeCount(w, traits);
      for (const t of traits ?? []) w.u8(TRAITS.indexOf(t));
      break;
    }
    case 'experience': {
      const ids = detail['experiences'] as string[] | undefined;
      writeMaybeCount(w, ids);
      for (const id of ids ?? []) {
        // Experience ids are reassigned on import, so the reference travels as
        // a position in this character's own list.
        const at = experienceIndex.get(id);
        if (at === undefined) {
          w.u8(0);
          w.str(id);
        } else {
          w.u8(at + 1);
        }
      }
      break;
    }
    case 'domainCard':
      refs.write(asRef(detail['cardRef']));
      break;
    case 'subclass':
      refs.write(asRef(detail['subclassRef']));
      break;
    case 'multiclass': {
      refs.write(asRef(detail['classRef']));
      const domain = detail['domain'] as DomainId | undefined;
      w.u8(domain === undefined ? 0 : DOMAINS.indexOf(domain) + 1);
      refs.write(asRef(detail['subclassRef']));
      break;
    }
    default:
      break;
  }

  if (extras.length > 0) {
    w.varint(extras.length);
    for (const [key, value] of extras) {
      w.str(key);
      w.str(JSON.stringify(value));
    }
  }
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

export interface DecodeResult {
  character: Character;
  /** Registry ids this device could not name. Also parked on the character. */
  unresolved: number[];
  /** Plain English, ready to show. Empty when everything resolved. */
  warnings: string[];
}

class RefReader {
  readonly unresolved = new Set<number>();
  constructor(
    private readonly r: Reader,
    private readonly registry: Registry,
  ) {}

  read(): Ref | null {
    const id = this.r.varint();
    if (id === 0) return null;
    const slug = isReserved(id) ? null : this.registry.slugOf(id);
    if (slug !== null) return slug;
    // Nothing is ever dropped: park the id in the ref itself and report it.
    this.unresolved.add(id);
    return unresolvedRef(id);
  }

  list(): Ref[] | undefined {
    const n = this.r.varint();
    if (n === 0) return undefined;
    const out: Ref[] = [];
    for (let i = 0; i < n - 1; i++) out.push(this.read() ?? '');
    return out;
  }
}

function readBody(bytes: Uint8Array, registry: Registry): DecodeResult {
  const r = new Reader(bytes);
  const refs = new RefReader(r, registry);
  const now = new Date().toISOString();

  const idKind = r.u8();
  let id: string;
  let createdAt = now;
  let updatedAt = now;
  if (idKind === ID_NONE) {
    id = crypto.randomUUID();
  } else {
    id = idKind === ID_UUID ? bytesToUuid(r.bytes(16)) : r.str();
    createdAt = readWhen(r) || now;
    updatedAt = readWhen(r) || now;
  }

  const name = r.str();
  const pronouns = r.str();
  const classRef = refs.read() ?? '';
  const subclassRefs = refs.list() ?? [];
  const ancestryRefs = refs.list() ?? [];
  const communityRef = refs.read();
  const multiclassRef = refs.read();
  const domainIndex = r.u8();
  const multiclassDomain: DomainId | null = domainIndex === 0 ? null : (DOMAINS[domainIndex - 1] ?? null);

  const level = r.varint();
  const traits = {} as Record<Trait, number>;
  for (const t of TRAITS) traits[t] = r.zigzag();
  const traitMarks: Partial<Record<Trait, number>> = {};
  for (let n = r.varint(); n > 0; n--) {
    const trait = TRAITS[r.u8()];
    const count = r.varint();
    if (trait !== undefined) traitMarks[trait] = count;
  }
  const hp = readCounter(r, 'hp', 'HP');
  const stress = readCounter(r, 'stress', 'Stress');
  const hope = readCounter(r, 'hope', 'Hope');
  const armorSlots = readCounter(r, 'armorSlots', 'Armor Slot');
  const evasionOverride = r.u8() === 0 ? null : r.zigzag();
  const thresholdOverride: [number, number] | null =
    r.u8() === 0 ? null : [r.zigzag(), r.zigzag()];

  const loadout = refs.list() ?? [];
  const vault = refs.list() ?? [];
  const activePrimaryWeapon = refs.read();
  const activeSecondaryWeapon = refs.read();
  const activeArmor = refs.read();

  const inventory: InventoryEntry[] = [];
  for (let n = r.varint(); n > 0; n--) {
    const ref = refs.read();
    const entryName = r.str();
    const quantity = r.varint();
    const note = r.maybeStr();
    inventory.push(
      note === undefined
        ? { ref, name: entryName, quantity }
        : { ref, name: entryName, quantity, note },
    );
  }

  const experiences: Experience[] = [];
  for (let n = r.varint(); n > 0; n--) {
    experiences.push({ id: crypto.randomUUID(), name: r.str(), bonus: r.zigzag() });
  }
  const gold = { handfuls: r.varint(), bags: r.varint(), chests: r.varint() };
  const connections: string[] = [];
  for (let n = r.varint(); n > 0; n--) connections.push(r.str());
  const notes = r.str();
  const scars: string[] = [];
  for (let n = r.varint(); n > 0; n--) scars.push(r.str());

  const levelUpHistory: LevelUpChoice[] = [];
  for (let n = r.varint(); n > 0; n--) levelUpHistory.push(readChoice(r, refs, experiences));

  const companion = r.u8() === 0 ? null : readCompanion(r);
  const beastform = r.u8() === 0 ? null : { ref: refs.read() ?? '', activatedAt: readWhen(r) };

  const parked = new Set<number>();
  for (let n = r.varint(); n > 0; n--) {
    // Ids the sender could not name. This device may be the one that can, in
    // which case they are simply resolved and stop being parked.
    const id = r.varint();
    if (isReserved(id) || registry.slugOf(id) === null) parked.add(id);
  }
  for (const unknown of refs.unresolved) parked.add(unknown);

  // The body is written to an exact length, so anything after it means the
  // bytes were not the ones that were sent. Reading a plausible character out
  // of a damaged payload and saying nothing is the one outcome to avoid.
  if (r.remaining > 0) {
    throw new CodecError(
      `The transfer is damaged: ${r.remaining} byte${r.remaining === 1 ? '' : 's'} left over after the character.`,
    );
  }

  const character: Character = {
    id,
    schemaVersion: SCHEMA_VERSION,
    name,
    pronouns,
    classRef,
    subclassRefs,
    ancestryRefs,
    communityRef,
    multiclassRef,
    multiclassDomain,
    level,
    traits,
    traitMarks,
    hp,
    stress,
    hope,
    armorSlots,
    evasionOverride,
    thresholdOverride,
    loadout,
    vault,
    activePrimaryWeapon,
    activeSecondaryWeapon,
    activeArmor,
    inventory,
    experiences,
    gold,
    connections,
    notes,
    levelUpHistory,
    companion,
    beastform,
    scars,
    // The third deliberate loss, named in the file header. Zero rather than
    // absent, so the decoded sheet is a whole `Character` and nothing
    // downstream has to cope with a field that is sometimes missing.
    consecutiveShortRests: 0,
    createdAt,
    updatedAt,
  };
  if (parked.size > 0) character.unresolvedRefs = [...parked].sort((a, b) => a - b);

  const unresolved = [...refs.unresolved].sort((a, b) => a - b);
  const warnings =
    unresolved.length === 0
      ? []
      : [
          `${unresolved.length} reference${unresolved.length === 1 ? '' : 's'} could not be found in this device's content ` +
            `(${unresolved.join(', ')}). They are kept on the sheet and will resolve when the missing source is added.`,
        ];
  return { character, unresolved, warnings };
}

function readChoice(r: Reader, refs: RefReader, experiences: readonly Experience[]): LevelUpChoice {
  const head = r.u8();
  const kindIndex = head & 0x0f;

  if (kindIndex === ESCAPED_CHOICE) {
    const kind = r.str() as AdvancementKind;
    const level = r.zigzag();
    const slot = r.zigzag();
    const raw = r.str();
    let detail: Record<string, unknown>;
    try {
      detail = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new CodecError('A level-up record in the transfer is damaged.');
    }
    return { level, slot, kind, detail };
  }

  const kind = ADVANCEMENT_KINDS[kindIndex];
  if (kind === undefined) throw new CodecError(`Unknown advancement kind ${kindIndex} in the transfer.`);
  const tierBits = (head >> 4) & 0x03;
  const slot = (head >> 6) & 0x01;
  const level = r.varint();

  const detail: Record<string, unknown> = {};
  switch (kind) {
    case 'trait': {
      const n = r.varint();
      if (n > 0) {
        const traits: Trait[] = [];
        for (let i = 0; i < n - 1; i++) {
          const t = TRAITS[r.u8()];
          if (t !== undefined) traits.push(t);
        }
        detail['traits'] = traits;
      }
      break;
    }
    case 'experience': {
      const n = r.varint();
      if (n > 0) {
        const ids: string[] = [];
        for (let i = 0; i < n - 1; i++) {
          const at = r.u8();
          if (at === 0) ids.push(r.str());
          else {
            const experience = experiences[at - 1];
            if (experience !== undefined) ids.push(experience.id);
          }
        }
        detail['experiences'] = ids;
      }
      break;
    }
    case 'domainCard': {
      const ref = refs.read();
      if (ref !== null) detail['cardRef'] = ref;
      break;
    }
    case 'subclass': {
      const ref = refs.read();
      if (ref !== null) detail['subclassRef'] = ref;
      break;
    }
    case 'multiclass': {
      const classRef = refs.read();
      if (classRef !== null) detail['classRef'] = classRef;
      const domainIndex = r.u8();
      if (domainIndex > 0 && DOMAINS[domainIndex - 1] !== undefined) {
        detail['domain'] = DOMAINS[domainIndex - 1];
      }
      const subclassRef = refs.read();
      if (subclassRef !== null) detail['subclassRef'] = subclassRef;
      break;
    }
    default:
      break;
  }

  detail['optionId'] = OPTION_ID_FOR_KIND[kind];
  if (tierBits !== NO_TIER) detail['optionTier'] = tierBits + 2;

  if ((head & 0x80) !== 0) {
    for (let n = r.varint(); n > 0; n--) {
      const key = r.str();
      const raw = r.str();
      try {
        detail[key] = JSON.parse(raw);
      } catch {
        throw new CodecError('A level-up record in the transfer is damaged.');
      }
    }
  }

  return { level, slot, kind, detail };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode a whole character. Throws `UnknownSlugError` when a reference has no
 * registry id - the caller should offer the file instead, which needs none.
 */
export async function encodeCharacter(
  c: Character,
  registry: Registry,
  options: EncodeOptions = {},
): Promise<Uint8Array> {
  const body = writeBody(c, registry, options);
  const squeezed = options.compress === false ? null : await deflateRaw(body);
  // Deflate loses on a payload this small more often than it wins; the flag
  // bit means we can simply take whichever came out shorter.
  const useDeflate = squeezed !== null && squeezed.length < body.length;
  const chosen = useDeflate ? squeezed : body;
  const out = new Uint8Array(BODY_AT[CODEC_VERSION]! + chosen.length);
  out[0] = CODEC_VERSION | (useDeflate ? DEFLATED_BIT : 0);
  out.set(chosen, BODY_AT[CODEC_VERSION]!);
  writeChecksum(out, payloadChecksum(out));
  return out;
}

/**
 * The checksum covers the payload with its own four bytes zeroed.
 *
 * Zeroed rather than skipped so that one sentence describes the coverage and
 * nothing in a format-2 payload sits outside it - the version nibble, the
 * deflate flag, the three header bits nothing reads, and every byte of the
 * body. A reader can check the rule without knowing where the field is.
 */
function payloadChecksum(payload: Uint8Array): number {
  const scratch = payload.slice();
  scratch.fill(0, 1, 1 + CHECKSUM_BYTES);
  return crc32(scratch);
}

/*
 * Written and read a byte at a time rather than through a `DataView`. Callers
 * hand this function a `subarray` - the reassembled QR payload is one - and a
 * DataView built from `.buffer` without passing `byteOffset` and `byteLength`
 * reads four bytes from the wrong place. `frames.ts` has that footgun twice and
 * only gets away with it once. Four lines of shifting cannot have the bug.
 */
function writeChecksum(payload: Uint8Array, sum: number): void {
  payload[1] = (sum >>> 24) & 0xff;
  payload[2] = (sum >>> 16) & 0xff;
  payload[3] = (sum >>> 8) & 0xff;
  payload[4] = sum & 0xff;
}

const readChecksum = (payload: Uint8Array): number =>
  ((payload[1]! << 24) | (payload[2]! << 16) | (payload[3]! << 8) | payload[4]!) >>> 0;

const isReadable = (version: number): boolean =>
  (READABLE_CODEC_VERSIONS as readonly number[]).includes(version);

export async function decodeCharacter(
  payload: Uint8Array,
  registry: Registry,
): Promise<DecodeResult> {
  if (payload.length < 2) throw new CodecError('That is not a character transfer: it is empty.');
  const header = payload[0]!;
  const version = header & VERSION_MASK;

  /*
   * The version is read before the checksum on purpose. A payload this build
   * cannot parse at all should be told apart from one it can parse and found
   * damaged, and checking the checksum first would report every unknown format
   * as corruption.
   *
   * The sentence says both possibilities because the code knows only one thing
   * - the nibble it read - and either could have produced it. Telling the user
   * to update their app would be a confident guess in exactly the case this
   * whole item exists to catch.
   */
  if (!isReadable(version)) {
    throw new CodecError(
      `This transfer says it is format ${version}, and this app reads ${READABLE_CODEC_VERSIONS.join(' and ')}. ` +
        'Either it came from a different version of the app, or it is damaged. Nothing has been imported.',
    );
  }

  const bodyAt = BODY_AT[version]!;
  if (version >= 2) {
    // Before reading the four bytes, not after: a three-byte payload declaring
    // format 2 would otherwise read past the end and checksum whatever it found.
    if (payload.length < bodyAt + 1) {
      throw new CodecError('The transfer ended early - it is incomplete or damaged.');
    }
    if (readChecksum(payload) !== payloadChecksum(payload)) {
      throw new CodecError(
        'The transfer is damaged: its checksum does not match the bytes that arrived, so nothing has been imported. Send it again.',
      );
    }
  }

  const raw = payload.subarray(bodyAt);
  const body = (header & DEFLATED_BIT) !== 0 ? await inflateRaw(raw) : raw;
  return readBody(body, registry);
}

/** True when the payload's body is deflated. For diagnostics and tests. */
export const isDeflated = (payload: Uint8Array): boolean =>
  payload.length > 0 && (payload[0]! & DEFLATED_BIT) !== 0;

/**
 * Every reference on a character, in one pass. Used to check a QR is possible
 * before offering it, and to re-resolve parked ids when content arrives.
 */
export function characterRefs(c: Character): Ref[] {
  const out: Ref[] = [];
  const add = (ref: Ref | null | undefined): void => {
    if (typeof ref === 'string' && ref !== '') out.push(ref);
  };
  add(c.classRef);
  c.subclassRefs.forEach(add);
  c.ancestryRefs.forEach(add);
  add(c.communityRef);
  add(c.multiclassRef);
  c.loadout.forEach(add);
  c.vault.forEach(add);
  add(c.activePrimaryWeapon);
  add(c.activeSecondaryWeapon);
  add(c.activeArmor);
  for (const entry of c.inventory) add(entry.ref);
  if (c.beastform !== null) add(c.beastform.ref);
  for (const choice of c.levelUpHistory) {
    for (const key of ['cardRef', 'subclassRef', 'classRef'] as const) {
      const value = choice.detail[key];
      if (typeof value === 'string') add(value);
    }
  }
  return out;
}

/** Slugs with no registry id. Empty means this character fits in a QR. */
export const missingSlugs = (c: Character, registry: Registry): string[] =>
  [...new Set(characterRefs(c).filter((r) => !isUnresolvedRef(r) && registry.idOf(r) === null))].sort();

export interface ResolveResult {
  character: Character;
  /** Ids that just became nameable. */
  resolved: number[];
}

/**
 * Re-resolve parked references after new content arrives. Architecture 5.3:
 * "they resolve themselves when the missing source turns up". Call it after a
 * dataset reload; it is a no-op when there is nothing parked.
 */
export function resolvePlaceholders(c: Character, registry: Registry): ResolveResult {
  const resolved = new Set<number>();
  const fix = (ref: Ref): Ref => {
    const id = unresolvedIdOf(ref);
    if (id === null) return ref;
    const slug = registry.slugOf(id);
    if (slug === null) return ref;
    resolved.add(id);
    return slug;
  };
  const fixOptional = (ref: Ref | null): Ref | null => (ref === null ? null : fix(ref));

  const next: Character = {
    ...c,
    classRef: fix(c.classRef),
    subclassRefs: c.subclassRefs.map(fix),
    ancestryRefs: c.ancestryRefs.map(fix),
    communityRef: fixOptional(c.communityRef),
    multiclassRef: fixOptional(c.multiclassRef),
    loadout: c.loadout.map(fix),
    vault: c.vault.map(fix),
    activePrimaryWeapon: fixOptional(c.activePrimaryWeapon),
    activeSecondaryWeapon: fixOptional(c.activeSecondaryWeapon),
    activeArmor: fixOptional(c.activeArmor),
    inventory: c.inventory.map((e) => ({ ...e, ref: fixOptional(e.ref) })),
    beastform: c.beastform === null ? null : { ...c.beastform, ref: fix(c.beastform.ref) },
    levelUpHistory: c.levelUpHistory.map((choice) => {
      const detail = { ...choice.detail };
      for (const key of ['cardRef', 'subclassRef', 'classRef'] as const) {
        const value = detail[key];
        if (typeof value === 'string') detail[key] = fix(value);
      }
      return { ...choice, detail };
    }),
  };

  const stillParked = (c.unresolvedRefs ?? []).filter((id) => !resolved.has(id));
  if (stillParked.length > 0) next.unresolvedRefs = stillParked;
  else delete next.unresolvedRefs;

  return { character: next, resolved: [...resolved].sort((a, b) => a - b) };
}
