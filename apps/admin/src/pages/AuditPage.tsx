import type { AuditLogsResponseDto } from '@vibe/api-contract';
import { useQuery } from '@tanstack/react-query';

import { api, errorText } from '../api';
import { formatDateTime } from '../labels';

export function AuditPage() {
  const logs = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => (await api<AuditLogsResponseDto>('/admin/audit-logs')).data,
  });
  return (
    <div className="stack">
      <h1>Denetim kaydı</h1>
      <p className="muted">Yönetici işlemlerinin değiştirilemez kaydı (son 100).</p>
      {logs.isError ? <p className="error">{errorText(logs.error)}</p> : null}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Yönetici</th>
              <th>İşlem</th>
              <th>Hedef</th>
              <th>Ayrıntı</th>
            </tr>
          </thead>
          <tbody>
            {logs.data?.map((l) => (
              <tr key={l.id}>
                <td>{formatDateTime(l.createdAt)}</td>
                <td>{l.adminEmail ?? '—'}</td>
                <td>
                  <code>{l.action}</code>
                </td>
                <td>
                  {l.targetType} <span className="muted">{l.targetId?.slice(0, 8)}</span>
                </td>
                <td className="muted">{l.metadata ? JSON.stringify(l.metadata) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
