import type { AdminIdentityDto, AdminUserResponseDto, UserAction } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { api, errorText } from '../api';
import type { Navigate } from '../App';
import { canEnforce, canModerate, formatDateTime, REASON, STATUS } from '../labels';

const ACTIONS: { action: UserAction; label: string; enforce: boolean; danger?: boolean }[] = [
  { action: 'REQUIRE_VERIFICATION', label: 'Selfie doğrulaması iste', enforce: false },
  { action: 'HOLD', label: 'Keşfetten gizle (inceleme)', enforce: false },
  { action: 'RELEASE_HOLD', label: 'Gizlemeyi kaldır', enforce: false },
  { action: 'SUSPEND', label: 'Askıya al', enforce: true, danger: true },
  { action: 'BAN', label: 'Kalıcı olarak kapat (ban)', enforce: true, danger: true },
  { action: 'RESTORE', label: 'Hesabı geri aç', enforce: true },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function UserPage({
  initialId,
  admin,
  navigate,
}: {
  initialId?: string;
  admin: AdminIdentityDto;
  navigate: Navigate;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState(initialId ?? '');
  const [userId, setUserId] = useState(initialId);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);

  const user = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: async () => (await api<AdminUserResponseDto>(`/admin/users/${userId}`)).data,
    enabled: Boolean(userId),
  });
  const act = useMutation({
    mutationFn: (action: UserAction) =>
      api<AdminUserResponseDto>(`/admin/users/${userId}/actions`, {
        method: 'POST',
        json: { action, reason, ...(action === 'SUSPEND' ? { days } : {}) },
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(['admin-user', userId], res.data);
      setReason('');
    },
  });

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (UUID.test(input.trim())) setUserId(input.trim());
  };

  const u = user.data;
  return (
    <div className="stack">
      <h1>Hesap</h1>
      <form className="row" onSubmit={search}>
        <input
          style={{ width: 380 }}
          placeholder="Kullanıcı kimliği (UUID)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!UUID.test(input.trim())}>
          Göster
        </button>
      </form>
      {user.isError ? <p className="error">{errorText(user.error)}</p> : null}
      {u ? (
        <>
          <div className="split">
            <div className="card stack">
              <h2>
                {u.displayName ?? 'Profil yok'}
                {u.age != null ? `, ${u.age}` : ''}
              </h2>
              <div className="row">
                <span className={`badge ${u.status === 'ACTIVE' ? '' : 'high'}`}>{u.status}</span>
                {u.verified ? <span className="badge">✓ doğrulanmış</span> : null}
                {u.verificationRequired ? (
                  <span className="badge medium">doğrulama istendi</span>
                ) : null}
                {u.moderationHold ? <span className="badge medium">keşfette gizli</span> : null}
              </div>
              {u.suspendedUntil ? (
                <div className="muted">Askı bitişi: {formatDateTime(u.suspendedUntil)}</div>
              ) : null}
              <div className="muted">
                Kayıt: {formatDateTime(u.createdAt)} · Son aktiflik:{' '}
                {formatDateTime(u.lastActiveAt)}
              </div>
              <div>{u.bio ?? <span className="muted">Hakkında yok</span>}</div>
              <div className="muted">Bu kişinin yaptığı şikayet sayısı: {u.reportsFiled}</div>
              <p className="notice">
                Mesaj içerikleri burada gösterilmez; yalnızca şikayet kanıtında görülebilir.
              </p>
            </div>
            <div className="card stack">
              <h2>İşlem</h2>
              {canModerate(admin.role) ? (
                <>
                  <label>
                    Gerekçe (zorunlu, denetim kaydına yazılır)
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  {canEnforce(admin.role) ? (
                    <label>
                      Askı süresi (gün)
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={days}
                        onChange={(e) => setDays(Number(e.target.value))}
                      />
                    </label>
                  ) : null}
                  <div className="row">
                    {ACTIONS.filter((a) => !a.enforce || canEnforce(admin.role)).map((a) => (
                      <button
                        key={a.action}
                        className={`btn ${a.danger ? 'danger' : ''}`}
                        disabled={act.isPending || reason.trim().length < 5}
                        onClick={() => act.mutate(a.action)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">Rolün yalnızca görüntülemeye izin veriyor.</p>
              )}
              {act.isError ? <p className="error">{errorText(act.error)}</p> : null}
            </div>
          </div>
          <div className="card stack">
            <h2>Fotoğraflar</h2>
            <div className="grid">
              {u.photos.map((p) => (
                <div key={p.id} className="stack" style={{ gap: 4 }}>
                  {p.url ? (
                    <img className="photo" src={p.url} alt="Profil fotoğrafı" />
                  ) : (
                    <div className="photo" />
                  )}
                  <span className="badge">{p.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card stack">
            <h2>Hakkındaki şikayetler</h2>
            {u.reportsAgainst.length === 0 ? <p className="muted">Şikayet yok.</p> : null}
            <table>
              <tbody>
                {u.reportsAgainst.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable"
                    onClick={() => navigate({ page: 'report', id: r.id })}
                  >
                    <td>{REASON[r.reason]}</td>
                    <td>{STATUS[r.status]}</td>
                    <td>{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
