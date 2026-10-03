import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The share card: navy background, the page title in Instrument Sans, and the
 * gold rule that means the same thing here as it does on the site.
 *
 * Generated at build for every static route, so a link to any page shares
 * something that looks like the site rather than a blank rectangle.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const NAVY = "#0F2A44";
const GOLD = "#D9A441";
const WHITE = "#FFFFFF";
/** The hero photo's height when drawn at the card's width. */
const HERO_HEIGHT = Math.round((OG_SIZE.width * 9) / 16);
const MUTED = "rgba(255, 255, 255, 0.72)";

async function font(file: string): Promise<ArrayBuffer> {
  // Read from disk rather than fetched at request time, so generating a card
  // never depends on the network being up.
  const buffer = await readFile(join(process.cwd(), "src/assets", file));
  return Uint8Array.from(buffer).buffer;
}

/**
 * A photograph from public/photos as a data URI, or null when the file has not
 * arrived. Read at build like the fonts.
 */
async function photo(file: string): Promise<string | null> {
  try {
    const buffer = await readFile(join(process.cwd(), "public/photos", file));
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

type Options = {
  /** A file in public/photos to set behind the title, under the hero gradient. */
  backgroundPhoto?: string;
};

export async function renderOgImage(
  title: string,
  kicker?: string,
  { backgroundPhoto }: Options = {},
) {
  const [regular, semibold, background] = await Promise.all([
    font("InstrumentSans-Regular.ttf"),
    font("InstrumentSans-SemiBold.ttf"),
    backgroundPhoto ? photo(backgroundPhoto) : Promise.resolve(null),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: NAVY,
          // The hero photo under the site's hero gradient, a little heavier so
          // the title holds at thumbnail size. Background layers rather than
          // positioned children, which Satori places inside the padding.
          ...(background
            ? {
                backgroundImage: `linear-gradient(to top, rgba(15,42,68,.92) 0%, rgba(15,42,68,.6) 55%, rgba(15,42,68,.2) 100%), url(${background})`,
                // The hero is 16:9 and the card is wider, so the photo is sized
                // to the card's width and centered, trimming its top and bottom.
                backgroundSize: `${OG_SIZE.width}px ${OG_SIZE.height}px, ${OG_SIZE.width}px ${HERO_HEIGHT}px`,
                backgroundPosition: `0 0, 0 ${-Math.round((HERO_HEIGHT - OG_SIZE.height) / 2)}px`,
              }
            : {}),
          padding: "72px 80px",
          fontFamily: "Instrument Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: WHITE,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 10,
            }}
          >
            <div style={{ width: 24, height: 6, borderRadius: 3, background: GOLD }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: WHITE }}>
            The Mona K Project
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {kicker ? (
            <div style={{ fontSize: 26, color: MUTED, marginBottom: 18 }}>{kicker}</div>
          ) : null}
          <div
            style={{
              fontSize: title.length > 70 ? 56 : 68,
              lineHeight: 1.1,
              fontWeight: 600,
              color: WHITE,
              letterSpacing: "-0.03em",
              display: "flex",
            }}
          >
            {title}
          </div>
          <div style={{ width: 120, height: 6, background: GOLD, marginTop: 28 }} />
        </div>

        <div style={{ fontSize: 22, color: MUTED, display: "flex" }}>
          Toledo&rsquo;s public records, explained. Every number linked to its source.
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Instrument Sans", data: regular, weight: 400, style: "normal" },
        { name: "Instrument Sans", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
