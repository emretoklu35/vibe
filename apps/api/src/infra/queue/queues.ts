/** Kuyruk ve iş adları tek yerde: API (üretici) ve worker (tüketici) aynı sabitleri kullanır. */
export const MEDIA_QUEUE = 'media';
export const PROCESS_PHOTO = 'process-photo';
export type ProcessPhotoJob = { photoId: string };

export const MAINTENANCE_QUEUE = 'maintenance';
export const PURGE_DELETED_ACCOUNTS = 'purge-deleted-accounts';
export const CLEANUP_STALE_UPLOADS = 'cleanup-stale-uploads';
export const RUN_RETENTION = 'run-retention';
export const BUILD_EXPORT = 'build-export';
export type BuildExportJob = { requestId: string };

export const NOTIFICATIONS_QUEUE = 'notifications';
export const SEND_PUSH = 'send-push';
export type PushKind = 'NEW_MATCH' | 'NEW_MESSAGE';
export type SendPushJob = {
  userId: string;
  kind: PushKind;
  conversationId?: string;
  matchId?: string;
};
