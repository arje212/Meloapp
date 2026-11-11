import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { uploadFile } from '@/lib/uploadFile';
import { Camera, Loader2, X, ChevronLeft, ChevronRight, Upload, ImageOff } from 'lucide-react';

export default function TripGallery({ trip, members = [] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const isMember = members.some(m => m.user_email === user?.email);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['trip-gallery', trip?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_photos')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.id,
  });

  const sorted = photos; // already sorted from query

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true); setUploadError('');
    try {
      await Promise.all(
        files.slice(0, 5).map(async (file) => {
          const url = await uploadFile(file, 'trip-gallery');
          const { error } = await supabase.from('trip_photos').insert({
            trip_id: trip.id,
            trip_title: trip.title,
            uploader_email: user.email,
            uploader_name: user.full_name || user.email,
            url,
            caption: '',
          });
          if (error) throw error;
        })
      );
      qc.invalidateQueries({ queryKey: ['trip-gallery', trip.id] });
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('Some photos could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (photo) => {
    if (photo.uploader_email !== user?.email) return;
    const { error } = await supabase.from('trip_photos').delete().eq('id', photo.id);
    if (error) console.error(error);
    qc.invalidateQueries({ queryKey: ['trip-gallery', trip.id] });
    setLightbox(null);
  };

  const prevPhoto = () => setLightbox(i => (i > 0 ? i - 1 : sorted.length - 1));
  const nextPhoto = () => setLightbox(i => (i < sorted.length - 1 ? i + 1 : 0));

  return (
    <div className="bg-card border rounded-2xl p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Trip gallery</h3>
          {photos.length > 0 && (
            <span className="text-xs text-muted-foreground">({photos.length} photos)</span>
          )}
        </div>
        {isMember && (
          <label className="cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <div className="flex items-center gap-1 text-xs border rounded-full px-3 h-7 hover:bg-muted transition-colors cursor-pointer select-none">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? 'Uploading...' : 'Upload'}
            </div>
          </label>
        )}
        {uploadError && <p role="alert" className="text-xs text-destructive">{uploadError}</p>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-8">
          <ImageOff className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {isMember ? 'No photos yet. Be the first to share!' : 'No photos shared yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {sorted.map((photo, idx) => (
            <button
              key={photo.id}
              className="aspect-square rounded-xl overflow-hidden relative group"
              onClick={() => setLightbox(idx)}
            >
              <img
                src={photo.url}
                alt={photo.caption || 'Trip photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              {photo.uploader_email === user?.email && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-xl" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && sorted[lightbox] && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white/70 hover:text-white"
              onClick={() => setLightbox(null)}
            >
              <X className="w-6 h-6" />
            </button>

            <img
              src={sorted[lightbox].url}
              alt=""
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />

            <div className="absolute bottom-3 left-3 right-3 text-white text-sm">
              <p className="font-medium drop-shadow">{sorted[lightbox].uploader_name}</p>
              {sorted[lightbox].caption && (
                <p className="text-white/70 text-xs mt-0.5">{sorted[lightbox].caption}</p>
              )}
            </div>

            {sorted[lightbox].uploader_email === user?.email && (
              <button
                className="absolute top-3 right-3 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors"
                onClick={() => handleDelete(sorted[lightbox])}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {sorted.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/80"
                  onClick={prevPhoto}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 hover:bg-black/80"
                  onClick={nextPhoto}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="absolute bottom-3 right-3 text-white/60 text-xs">
              {lightbox + 1} / {sorted.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}