/**
 * The one paragraph shape every open session row uses: dim, dense, 62ch.
 *
 * It is a sentence with no control beside it, which is the whole point of
 * having a name for it. `SessionBody.tsx` argues the rule at length - what has
 * no verb is stated as a fact rather than given a button that quietly does
 * less than it says - and a row that wrote that sentence out with its own
 * inline styles would be one refactor away from saying it at a different size
 * from the row above it.
 *
 * ## Why it is a file rather than a const in `SessionBody.tsx`
 *
 * Two arms moved out of `SessionBody.tsx` into files of their own - `UrlArm`
 * and `NoteArm`, because two separate lanes are about to replace them
 * wholesale - and both of them draw this. Left where it was, each of those
 * files would have imported it back out of `SessionBody.tsx`, and
 * `SessionBody.tsx` imports both of them: two modules importing each other,
 * which works in ESM until the day something in one of them runs at module
 * scope. One small file is cheaper than that cycle, and cheaper than a second
 * copy of four lines that has to keep agreeing with the first.
 */
export const Fact = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
    {children}
  </p>
);
