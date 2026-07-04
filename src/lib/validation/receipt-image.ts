/**
 * Hard server-side validation for publicly submitted receipt images.
 *
 * 1. Magic-byte sniffing — only real JPEG/PNG/WEBP byte signatures pass;
 *    PDFs, executables, SVG/HTML polyglots are rejected before any decode.
 * 2. Full re-encode via sharp — the stored artifact is a freshly generated
 *    plain JPEG, so any payload hidden in the original bytes is destroyed.
 */

const MAX_STORED_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 2000;

export type ImageValidationResult =
  | { ok: true; jpeg: Buffer }
  | { ok: false; reason: string };

function sniffImageType(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function validateAndReencodeReceiptImage(
  input: Buffer,
): Promise<ImageValidationResult> {
  const kind = sniffImageType(input);
  if (!kind) {
    return { ok: false, reason: "Not a valid JPG, PNG or WEBP image." };
  }

  // Lazy import: if the native module fails to load in some runtime, the
  // route degrades to a clean JSON error instead of crashing at cold start.
  let sharp: (typeof import("sharp"))["default"];
  try {
    sharp = (await import("sharp")).default;
  } catch (err) {
    console.error("sharp failed to load:", err);
    // TEMP DIAGNOSTIC: surface load error detail
    return {
      ok: false,
      reason: `Image processing is unavailable: ${err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300)}`,
    };
  }

  try {
    const jpeg = await sharp(input, {
      // Never accept animated input; cap decoded pixels to block decompression bombs.
      pages: 1,
      limitInputPixels: 40_000_000,
    })
      .rotate() // apply EXIF orientation, then strip metadata by re-encoding
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    if (jpeg.length > MAX_STORED_BYTES) {
      return { ok: false, reason: "Image is too large even after compression." };
    }
    return { ok: true, jpeg };
  } catch {
    return { ok: false, reason: "The file could not be decoded as an image." };
  }
}
