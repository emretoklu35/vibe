import type { ReportStatus, ReportsResponseDto } from '@vibe/api-contract';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { api, errorText } from '../api';
import type { Navigate } from '../App';
import { formatDateTime, REASON, STATUS, TARGET } from '../labels';

const FILTERS: { label: string; value?: ReportStatus }[] = [
  { label: 'Bekleyenler' },
  { label: 'İşlem yapılanlar', value: 'ACTION_TAKEN' },
  { label: 'Reddedilenler', value: 'DISMISSED' },
];

export const priorityClass = (p: number) => (p >= 90 ? 'high' : p >= 60 ? 'medium' : '');

export function ReportsPage({ navigate }: { navigate: Navigate }) {
  const [status, setStatus] = useState<ReportStatus | undefined>();
  const reports = useQuery({
    queryKey: ['admin-reports', status ?? 'pending'],
    queryFn: async () =>
      (await api<ReportsResponseDto>(`/admin/reports${status ? `?status=${status}` : ''}`)).data,
    refetchInterval: 30_000,
  });

  return (
    <div className="stack">
      <h1>Şikayetler</h1>
      <div className="row" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            role="tab"
            aria-selected={status === f.value}
            className={`btn ${status === f.value ? 'primary' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="card">
        {reports.isError ? <p className="error">{errorText(reports.error)}</p> : null}
        {reports.data?.length === 0 ? <p className="muted">Bu listede şikayet yok.</p> : null}
        {reports.data && reports.data.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Öncelik</th>
                <th>Neden</th>
                <th>Konu</th>
                <th>Şikayet edilen</th>
                <th>Açık şikayet</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {reports.data.map((r) => (
                <tr
                  key={r.id}
                  className="clickable"
                  onClick={() => navigate({ page: 'report', id: r.id })}
                >
                  <td>
                    <span className={`badge ${priorityClass(r.priority)}`}>{r.priority}</span>
                  </td>
                  <td>{REASON[r.reason]}</td>
                  <td>{TARGET[r.targetType]}</td>
                  <td>{r.reportedName ?? <span className="muted">Silinmiş hesap</span>}</td>
                  <td>{r.openReportsAgainst}</td>
                  <td>{STATUS[r.status]}</td>
                  <td>{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
