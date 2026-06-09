/**
 * Client-side image compression — EGRESS CRITICAL
 *
 * Why this exists: raw phone photos are 3–8 MB. Every product image is
 * served from Supabase Storage, and every byte counts against the plan's
 * egress quota. Compressing to WebP at max 1200px typically yields
 * 80–250 KB per image — a 15–40× reduction in storage egress per view.
 *
 * Usage:
 *   const compressed = await compressImage(file);            // product photos
 *   const compressed = await compressImage(file, 800, 0.75); // avatars/thumbnails
 */

const DEFAULT_MAX_DIM = 1200;
const DEFAULT_QUALITY = 0.8;

/** Cache-Control for uploaded objects. Filenames are unique (random/timestamped),
 *  so content is immutable — cache for 1 year at browser + CDN level. */
export const IMMUTABLE_CACHE = '31536000';

export async function compressImage(
  file: File | Blob,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = DEFAULT_QUALITY,
): Promise<Blob> {
  // Don't touch non-images (e.g. chat file attachments) or SVGs
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  // Already small enough? Skip the canvas round-trip
  if (file.size <= 150 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
    // Only use the compressed version if it's actually smaller
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    // Any failure (unsupported format, memory) — fall back to original
    return file;
  }
}

/** Derive the right file extension after possible WebP conversion */
export function extFor(blob: Blob, fallback = 'webp'): string {
  const sub = blob.type.split('/')[1];
  return sub === 'jpeg' ? 'jpg' : (sub || fallback);
}
