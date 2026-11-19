import type { ReviewPhotosResponseDto } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, errorText } from '../api';
import { formatDateTime } from '../labels';

export function PhotosPage() {
  const queryClient = useQueryClient();
  const photos = useQuery({
    queryKey: ['admin-photos'],
    queryFn: async () => (await api<ReviewPhotosResponseDto>('/admin/moderation/photos')).data,
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      api(`/admin/moderation/photos/${id}`, { method: 'POST', json: { decision } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-photos'] }),
  });

  return (
    <div className="stack">
      <h1>Fotoğraf inceleme</h1>
      <p className="muted">
        Otomatik denetimin emin olamadığı fotoğraflar. Reşit olmayan görünümlü kişi veya çıplaklık
        varsa reddet ve hesabı incele.
      </p>
      {photos.isError ? <p className="error">{errorText(photos.error)}</p> : null}
      {decide.isError ? <p className="error">{errorText(decide.error)}</p> : null}
      {photos.data?.length === 0 ? <p className="notice">İnceleme bekleyen fotoğraf yok.</p> : null}
      <div className="grid">
        {photos.data?.map((p) => (
          <div key={p.id} className="card stack" style={{ padding: 10, gap: 8 }}>
            <img className="photo" src={p.url} alt="İncelenecek fotoğraf" />
            <span className="muted" style={{ fontSize: 12 }}>
              {formatDateTime(p.createdAt)}
            </span>
            <div className="row">
              <button
                className="btn success"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: p.id, decision: 'APPROVED' })}
              >
                Onayla
              </button>
              <button
                className="btn danger"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: p.id, decision: 'REJECTED' })}
              >
                Reddet
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
