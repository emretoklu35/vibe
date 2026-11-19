import type { AdminIdentityDto, ReportDetailResponseDto } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api, errorText } from '../api';
import type { Navigate } from '../App';
import { canModerate, formatDateTime, REASON, STATUS, TARGET } from '../labels';
import { priorityClass } from './ReportsPage';

type Evidence = {
  capturedAt?: string;
  purged?: boolean;
  profile?: Record<string, unknown> | null;
  reportedPhotoIndex?: number | null;
  message?: { body: string; createdAt: string };
  context?: { from: 'reported' | 'reporter' | 'system'; body: string; createdAt: string }[];
};

const PROFILE_FIELD: Record<string, string> = {
  displayName: 'Ad',
  age: 'Yaş',
  bio: 'Hakkında',
  jobTitle: 'Meslek',
  cityName: 'Şehir',
  gender: 'Cinsiyet',
  interests: 'İlgi alanları',
};

export function ReportDetailPage({
  id,
  admin,
  navigate,
}: {
  id: string;
  admin: AdminIdentityDto;
  navigate: Navigate;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const report = useQuery({
    queryKey: ['admin-report', id],
    queryFn: async () => (await api<ReportDetailResponseDto>(`/admin/reports/${id}`)).data,
  });
  const update = useMutation({
    mutationFn: (status: 'IN_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED') =>
      api(`/admin/reports/${id}`, { method: 'PATCH', json: { status, note: note || undefined } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-report', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
    },
  });

  if (report.isPending) return <p className="muted">Yükleniyor…</p>;
  if (report.isError) return <p className="error">{errorText(report.error)}</p>;
  const r = report.data;
  const evidence = r.evidence as Evidence;
  const open = r.status === 'OPEN' || r.status === 'IN_REVIEW';

  return (
    <div className="stack">
      <div className="row">
        <button className="btn" onClick={() => navigate({ page: 'reports' })}>
          ‹ Şikayetler
        </button>
        <h1 style={{ margin: 0 }}>{REASON[r.reason]}</h1>
        <span className={`badge ${priorityClass(r.priority)}`}>öncelik {r.priority}</span>
        <span className="badge">{STATUS[r.status]}</span>
      </div>

      <div className="split">
        <div className="card stack">
          <h2>Bilgiler</h2>
          <div>
            <span className="muted">Konu: </span>
            {TARGET[r.targetType]}
          </div>
          <div>
            <span className="muted">Şikayet edilen: </span>
            {r.reportedUserId ? (
              <a
                href="#"
                onClick={(e) => (
                  e.preventDefault(),
                  navigate({ page: 'user', id: r.reportedUserId! })
                )}
              >
                {r.reportedName ?? r.reportedUserId}
              </a>
            ) : (
              'Silinmiş hesap'
            )}{' '}
            <span className="muted">({r.openReportsAgainst} açık şikayet)</span>
          </div>
          <div>
            <span className="muted">Tarih: </span>
            {formatDateTime(r.createdAt)}
          </div>
          <div>
            <span className="muted">Şikayet edenin notu: </span>
            {r.comment ?? '—'}
          </div>
          {r.resolvedAt ? (
            <div>
              <span className="muted">Karar: </span>
              {formatDateTime(r.resolvedAt)} · {r.handledBy} · {r.resolutionNote ?? 'not yok'}
            </div>
          ) : null}
        </div>

        <div className="card stack">
          <h2>Karar</h2>
          {!canModerate(admin.role) ? (
            <p className="muted">Rolün yalnızca görüntülemeye izin veriyor.</p>
          ) : null}
          {canModerate(admin.role) && open ? (
            <>
              <label>
                Not (denetim kaydına yazılır)
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="row">
                {r.status === 'OPEN' ? (
                  <button
                    className="btn"
                    disabled={update.isPending}
                    onClick={() => update.mutate('IN_REVIEW')}
                  >
                    İncelemeye al
                  </button>
                ) : null}
                <button
                  className="btn primary"
                  disabled={update.isPending}
                  onClick={() => update.mutate('ACTION_TAKEN')}
                >
                  İşlem yapıldı
                </button>
                <button
                  className="btn"
                  disabled={update.isPending}
                  onClick={() => update.mutate('DISMISSED')}
                >
                  Asılsız / reddet
                </button>
              </div>
              <p className="muted">
                Hesaba yaptırım (askıya alma, ban, doğrulama isteme) hesap sayfasından yapılır.
              </p>
            </>
          ) : null}
          {update.isError ? <p className="error">{errorText(update.error)}</p> : null}
        </div>
      </div>

      <div className="card stack">
        <h2>
          Kanıt{' '}
          {evidence.capturedAt ? (
            <span className="muted">({formatDateTime(evidence.capturedAt)})</span>
          ) : null}
        </h2>
        {evidence.purged ? (
          <p className="notice">Kanıt saklama süresi dolduğu için silindi.</p>
        ) : null}
        {evidence.profile ? (
          <table>
            <tbody>
              {Object.entries(evidence.profile).map(([key, value]) => (
                <tr key={key}>
                  <th style={{ width: 160 }}>{PROFILE_FIELD[key] ?? key}</th>
                  <td>
                    {value == null ? '—' : Array.isArray(value) ? value.join(', ') : String(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {r.evidencePhotoUrls.length > 0 ? (
          <div className="grid">
            {r.evidencePhotoUrls.map((url, index) => (
              <div key={url} className="stack" style={{ gap: 4 }}>
                <img className="photo" src={url} alt={`Kanıt fotoğrafı ${index + 1}`} />
                {evidence.reportedPhotoIndex === index ? (
                  <span className="badge high">Şikayet edilen fotoğraf</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {evidence.context ? (
          <div className="stack">
            <h3>Sohbet bağlamı (son {evidence.context.length} mesaj)</h3>
            <div className="transcript">
              {evidence.context.map((m, index) => (
                <div key={index} className={`bubble ${m.from}`}>
                  {m.body || <em className="muted">silinmiş mesaj</em>}
                  <small>
                    {m.from === 'reported'
                      ? 'Şikayet edilen'
                      : m.from === 'reporter'
                        ? 'Şikayet eden'
                        : 'Sistem'}{' '}
                    · {formatDateTime(m.createdAt)}
                  </small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
