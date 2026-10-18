import Image from "next/image";

/** public/brand/mkp-logo.png, cropped from the supplied 2000px artwork. */
const WIDTH = 640;
const HEIGHT = 282;

type Props = {
  /** Rendered height in px; the width follows the artwork's ratio. */
  height: number;
  priority?: boolean;
};

/**
 * The mkp. logo. It sits beside the visible site name everywhere it is used,
 * so it is decorative and carries an empty alt.
 */
export function BrandLogo({ height, priority }: Props) {
  return (
    <Image
      className="brand-logo"
      src="/brand/mkp-logo.png"
      alt=""
      width={WIDTH}
      height={HEIGHT}
      style={{ height, width: Math.round((height * WIDTH) / HEIGHT) }}
      priority={priority}
    />
  );
}
