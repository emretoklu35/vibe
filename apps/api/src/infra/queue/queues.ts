/** Kuyruk ve iş adları tek yerde: API (üretici) ve worker (tüketici) aynı sabitleri kullanır. */
export const MEDIA_QUEUE = 'media';
export const PROCESS_PHOTO = 'process-photo';
export type ProcessPhotoJob = { photoId: string };

export const MAINTENANCE_QUEUE = 'maintenance';
export const PURGE_DELETED_ACCOUNTS = 'purge-deleted-accounts';
export const CLEANUP_STALE_UPLOADS = 'cleanup-stale-uploads';
