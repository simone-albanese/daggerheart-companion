/**
 * The pieces every settings section is built from.
 *
 * A settings screen is the one place in this app that is genuinely a list of
 * rows, so it gets a row: a name, a sentence saying what it does, and one
 * control on the right. The sentence is not decoration - most of what this
 * screen decides (persistent storage, physical dice, removing the manual) is
 * only a sensible choice if you know what it costs.
 *
 * Hairlines come from a 1px grid gap over a line-coloured panel, so the first
 * and last rows meet the panel's rounded corners cleanly without a stylesheet.
 */
import type { CSSProperties, ReactNode } from 'react';

export function Section({
  id,
  title,
  lead,
  children,
  innerRef,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
  innerRef?: (el: HTMLElement | null) => void;
}): React.JSX.Element {
  return (
    <section
      id={id}
      ref={innerRef}
      aria-labelledby={`${id}-title`}
      style={{ scrollMarginTop: 12 }}
    >
      <h2 id={`${id}-title`} className="t-label" style={{ margin: 0 }}>
        {title}
      </h2>
      {lead !== undefined && (
        <p className="t-body" style={{ margin: '8px 0 0', maxWidth: '64ch' }}>
          {lead}
        </p>
      )}
      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>{children}</div>
    </section>
  );
}

/** A group of rows. Children are `Field`s, or anything with its own background. */
export function Rows({ children, style }: { children: ReactNode; style?: CSSProperties }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: 1,
        background: 'var(--line-soft)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--r4)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  footer,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  /** Anything that needs the full width under the row: a demo strip, a list. */
  footer?: ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ background: 'var(--panel)', padding: '13px 14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        {/* A 180px basis is what decides the phone layout: a switch stays on
            the label's line, a three-way choice drops below it and aligns
            left, where a right-aligned orphan control would look like a
            mistake. */}
        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
          <div style={{ font: '600 14px/1.3 var(--sans)', color: 'var(--text)' }}>{label}</div>
          {hint !== undefined && (
            <div className="t-dense" style={{ marginTop: 5, maxWidth: '62ch' }}>
              {hint}
            </div>
          )}
        </div>
        {children !== undefined && (
          <div className="row" style={{ flex: 'none', gap: 8, flexWrap: 'wrap' }}>
            {children}
          </div>
        )}
      </div>
      {footer !== undefined && <div style={{ marginTop: 12 }}>{footer}</div>}
    </div>
  );
}

/**
 * A switch that says ON or OFF in words as well as position. Colour is never
 * the only carrier of meaning, and that rule does not stop at the domain marks.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="row"
      style={{
        minHeight: 'var(--tap)',
        gap: 10,
        padding: '0 2px 0 8px',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="t-meta"
        style={{ width: 22, textAlign: 'right', color: checked ? 'var(--hope)' : 'var(--dim)' }}
      >
        {checked ? 'ON' : 'OFF'}
      </span>
      <span
        style={{
          position: 'relative',
          display: 'block',
          width: 46,
          height: 26,
          borderRadius: 13,
          background: checked ? 'var(--hope)' : 'var(--empty)',
          border: `1px solid ${checked ? 'var(--hope)' : 'var(--line)'}`,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: checked ? 'var(--app)' : 'var(--muted)',
            transform: `translateX(${checked ? 20 : 0}px)`,
            transition: 'transform var(--motion)',
          }}
        />
      </span>
    </button>
  );
}

export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<[T, string]>;
  label: string;
}): React.JSX.Element {
  // A group of toggle buttons, not a radiogroup: `role="radio"` promises arrow-key
  // navigation between the options, and a browser gives a plain button none. Same
  // idiom as the segmented control in build/parts.tsx.
  return (
    <div
      role="group"
      aria-label={label}
      className="row"
      style={{ gap: 2, padding: 2, borderRadius: 'var(--r3)', background: 'var(--app)' }}
    >
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className="chip"
          style={{
            minHeight: 'var(--control)',
            padding: '0 12px',
            background: value === id ? 'var(--raised)' : 'transparent',
            color: value === id ? 'var(--text)' : 'var(--muted)',
            border: `1px solid ${value === id ? 'var(--line)' : 'transparent'}`,
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export type Tone = 'neutral' | 'warn' | 'danger';

const TONE: Record<Tone, { edge: string; wash: string }> = {
  neutral: { edge: 'var(--line-soft)', wash: 'var(--panel)' },
  warn: { edge: 'var(--hope)', wash: 'var(--hope-wash)' },
  danger: { edge: 'var(--damage)', wash: 'rgb(255 93 82 / 0.10)' },
};

/** A block of prose that needs to be read, not skimmed past. */
export function Note({
  tone = 'neutral',
  children,
  role,
}: {
  tone?: Tone;
  children: ReactNode;
  role?: 'status' | 'alert';
}): React.JSX.Element {
  const { edge, wash } = TONE[tone];
  return (
    <div
      role={role}
      className="t-dense"
      style={{
        background: wash,
        border: `1px solid ${edge}`,
        borderRadius: 'var(--r3)',
        padding: '10px 12px',
        color: 'var(--text-2)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
