/**
 * iPhone photos are often HEIC/HEIF, which Android and most browsers cannot display (broken image).
 * Convert them to JPEG before upload. Any other file is returned unchanged.
 */
export const isHeic = (file) =>
  !!file && (/heic|heif/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || ''));

export async function prepareImageFile(file) {
  if (!isHeic(file)) return file;
  try {
    const { default: heic2any } = await import('heic2any'); // loaded only when needed (it is large)
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const blob = Array.isArray(out) ? out[0] : out;
    const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (err) {
    console.warn('[image] HEIC conversion failed:', err);
    throw new Error('Could not convert the HEIC photo. Try saving it as a JPG.');
  }
}

/**
 * Shrink big phone photos before upload (a 12 MP photo is 4-8 MB; 1600 px is plenty for the app).
 * Returns the original file when it is not a resizable image or already small.
 */
export async function downscaleImage(file, maxSide = 1600, quality = 0.85) {
  if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) { bitmap.close?.(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // keep the original if the browser cannot decode it
  }
}
