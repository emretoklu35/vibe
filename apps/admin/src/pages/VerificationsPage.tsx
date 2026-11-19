import type { VerificationsResponseDto } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api, errorText } from '../api';
import { formatDateTime } from '../labels';

export function VerificationsPage() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const items = useQuery({
    queryKey: ['admin-verifications'],
    queryFn: async () => (await api<VerificationsResponseDto>('/admin/verifications')).data,
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      api(`/admin/verifications/${id}`, {
        method: 'POST',
        json: { decision, note: notes[id] || undefined },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-verifications'] }),
  });

  return (
    <div className="stack">
      <h1>Selfie doğrulama</h1>
      <p className="muted">
        Selfie’deki kişinin profil fotoğraflarındaki kişiyle aynı olduğundan emin olduğunda onayla.
        Selfie karardan 30 gün sonra silinir.
      </p>
      {items.isError ? <p className="error">{errorText(items.error)}</p> : null}
      {decide.isError ? <p className="error">{errorText(decide.error)}</p> : null}
      {items.data?.length === 0 ? <p className="notice">Bekleyen doğrulama yok.</p> : null}
      {items.data?.map((v) => (
        <div key={v.id} className="card stack">
          <div className="row">
            <strong>{v.displayName ?? v.userId}</strong>
            <span className="muted">{formatDateTime(v.submittedAt)}</span>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ width: 220 }} className="stack">
              <span className="badge medium">Selfie</span>
              {v.selfieUrl ? <img className="photo" src={v.selfieUrl} alt="Selfie" /> : null}
            </div>
            {v.profilePhotoUrls.map((url, i) => (
              <div key={url} style={{ width: 160 }} className="stack">
                <span className="badge">Profil {i + 1}</span>
                <img className="photo" src={url} alt={`Profil fotoğrafı ${i + 1}`} />
              </div>
            ))}
          </div>
          <label>
            Ret gerekçesi (kullanıcıya gösterilir)
            <input
              value={notes[v.id] ?? ''}
              maxLength={500}
              onChange={(e) => setNotes((prev) => ({ ...prev, [v.id]: e.target.value }))}
              placeholder="ör. Yüz net görünmüyor, tekrar dene"
            />
          </label>
          <div className="row">
            <button
              className="btn success"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: v.id, decision: 'APPROVED' })}
            >
              Aynı kişi — onayla
            </button>
            <button
              className="btn danger"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: v.id, decision: 'REJECTED' })}
            >
              Reddet
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
