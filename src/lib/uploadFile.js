import { supabase } from '@/lib/supabase';

/**
 * Upload a file to Supabase storage and return its public URL.
 * Use this everywhere instead of calling supabase.storage directly
 * or base44.integrations.Core.UploadFile.
 *
 * @param {File} file
 * @param {string} folder  - storage folder, e.g. 'uploads', 'trip-proofs', 'banners'
 * @returns {Promise<string>} public URL
 */
export async function uploadFile(file, folder = 'uploads') {
  const ext  = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('files')
    .upload(path, file, { contentType: file.type });

  if (error) throw error;

  return supabase.storage.from('files').getPublicUrl(path).data.publicUrl;
}
