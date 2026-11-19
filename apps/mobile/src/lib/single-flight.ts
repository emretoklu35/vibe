/**
 * Aynı anda gelen çağrıları tek bir işleme bağlar. Token yenilemede zorunlu: sunucu, eski refresh
 * token'ın ikinci kez kullanılmasını çalınma olarak görür ve oturumu kapatır.
 */
export function singleFlight<T>(task: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined;
  return () => {
    inFlight ??= task().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}
