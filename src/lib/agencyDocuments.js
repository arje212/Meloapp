import { supabase } from '@/lib/supabase';

const BUCKET = 'agency-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function uploadAgencyDocument(file, userId, agencyId) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Choose a PDF, JPG, PNG, or WebP document.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Agency documents must be 10MB or smaller.');
  }

  const extension = (file.name.split('.').pop() || 'file')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || 'file';
  const path = `${userId}/${agencyId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });

  if (error) throw error;
  return path;
}

export async function getAgencyDocumentUrl(path) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 10 * 60);
  if (error) throw error;
  return data.signedUrl;
}
