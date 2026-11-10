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
