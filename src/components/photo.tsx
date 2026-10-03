import Image from "next/image";
import { clsx } from "clsx";

/** Files present in public/photos at build, from next.config.ts. */
const AVAILABLE = new Set((process.env.MKP_PHOTOS ?? "").split(",").filter(Boolean));

export function hasPhoto(file: string): boolean {
  return AVAILABLE.has(file);
}

type Props = {
  file: string;
  /** What is in the frame, for someone who cannot see it. */
  alt: string;
  /** Width over height, as the CSS aspect-ratio value, e.g. "3 / 2". */
  ratio: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * A photograph from public/photos, or a navy block of the same shape when the
 * file has not arrived yet. The block carries no text: it is a slot, not a
 * placeholder message, and it is hidden from screen readers because there is
 * nothing in it to describe.
 */
export function Photo({ file, alt, ratio, sizes, priority, className }: Props) {
  const present = hasPhoto(file);
  return (
    <div
      className={clsx("photo", className)}
      style={{ aspectRatio: ratio }}
      aria-hidden={present ? undefined : true}
    >
      {present ? (
        <Image src={`/photos/${file}`} alt={alt} fill sizes={sizes} priority={priority} />
      ) : null}
    </div>
  );
}
