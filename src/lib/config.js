// Platform payment account shown to agencies / users. Override per environment with
// VITE_ADMIN_GCASH_NUMBER and VITE_ADMIN_GCASH_NAME (no code change needed to rotate the number).
export const ADMIN_GCASH_NUMBER = import.meta.env.VITE_ADMIN_GCASH_NUMBER || '09750944563';
export const ADMIN_GCASH_NAME   = import.meta.env.VITE_ADMIN_GCASH_NAME   || 'Melotrip Admin';
