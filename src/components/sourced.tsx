import type { ReactNode } from "react";

type SourcedProps = {
  /** URL of the public document this figure came from. */
  href: string;
  children: ReactNode;
  /** Thicker underline, for the headline figure in the Explorer. */
  large?: boolean;
  id?: string;
};

/**
 * A number that links to the public record it came from.
 *
 * The gold underline is reserved for this component and is used nowhere else
 * on the site, so a gold rule always means "this links to a source document".
 */
export function Sourced({ href, children, large = false, id }: SourcedProps) {
  return (
    <a
      id={id}
      className={large ? "src src-lg" : "src"}
      href={href}
      title="Links to source document."
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
