/**
 * Wraps a wide table so it scrolls inside its own box rather than pushing the
 * whole page sideways on a phone.
 *
 * tabIndex and role make the scroll box reachable from the keyboard, which a
 * scrollable region needs in order to be operable without a pointer.
 */
export function ScrollableTable({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
