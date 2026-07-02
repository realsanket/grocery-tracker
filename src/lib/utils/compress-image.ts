/**
 * Client-side receipt image downscaling.
 * Keeps uploads under serverless body limits (Vercel: 4.5 MB) and
 * reduces vision-model input cost. Runs only in the browser.
 */

const MAX_DIMENSION = 1800;
const JPEG_QUALITY = 0.85;
const SKIP_BELOW_BYTES = 900 * 1024;

export async function compressReceiptImage(file: File): Promise<File> {
  if (file.size < SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Fall back to the original file if decoding fails (e.g. odd formats).
    return file;
  }
}
