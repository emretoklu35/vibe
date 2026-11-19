import type { AdminIdentityDto, AdminMeResponseDto } from '@vibe/api-contract';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api, session } from './api';
import { canEnforce, canModerate, ROLE } from './labels';
import { AuditPage } from './pages/AuditPage';
import { LoginPage } from './pages/LoginPage';
import { PhotosPage } from './pages/PhotosPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { UserPage } from './pages/UserPage';
import { VerificationsPage } from './pages/VerificationsPage';

/** Basit durum tabanlı gezinme (yönlendirici kütüphanesine gerek yok). */
export type Route =
  | { page: 'reports' }
  | { page: 'report'; id: string }
  | { page: 'photos' }
  | { page: 'verifications' }
  | { page: 'user'; id?: string }
  | { page: 'audit' };

export type Navigate = (route: Route) => void;

export function App() {
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState(Boolean(session.get()));
  const [route, setRoute] = useState<Route>({ page: 'reports' });
  const me = useQuery({
    queryKey: ['admin-me'],
    queryFn: async () => (await api<AdminMeResponseDto>('/admin/auth/me')).data,
    enabled: signedIn,
  });

  useEffect(() => {
    const onSignedOut = () => {
      setSignedIn(false);
      queryClient.clear();
    };
    window.addEventListener('vibe-admin-signed-out', onSignedOut);
    return () => window.removeEventListener('vibe-admin-signed-out', onSignedOut);
  }, [queryClient]);

  if (!signedIn) return <LoginPage onSignedIn={() => setSignedIn(true)} />;
  if (!me.data)
    return <div className="login muted">{me.isError ? 'Oturum doğrulanamadı' : 'Yükleniyor…'}</div>;

  const logout = async () => {
    await api('/admin/auth/logout', { method: 'POST' }).catch(() => undefined);
    session.clear();
    queryClient.clear();
    setSignedIn(false);
  };

  return (
    <div className="layout">
      <Sidebar admin={me.data} route={route} navigate={setRoute} onLogout={() => void logout()} />
      <main>
        {route.page === 'reports' && <ReportsPage navigate={setRoute} />}
        {route.page === 'report' && (
          <ReportDetailPage id={route.id} admin={me.data} navigate={setRoute} />
        )}
        {route.page === 'photos' && <PhotosPage />}
        {route.page === 'verifications' && <VerificationsPage />}
        {route.page === 'user' && (
          <UserPage initialId={route.id} admin={me.data} navigate={setRoute} />
        )}
        {route.page === 'audit' && <AuditPage />}
      </main>
    </div>
  );
}

function Sidebar({
  admin,
  route,
  navigate,
  onLogout,
}: {
  admin: AdminIdentityDto;
  route: Route;
  navigate: Navigate;
  onLogout: () => void;
}) {
  const items: { label: string; route: Route; show: boolean }[] = [
    { label: 'Şikayetler', route: { page: 'reports' }, show: true },
    { label: 'Fotoğraf inceleme', route: { page: 'photos' }, show: canModerate(admin.role) },
    { label: 'Selfie doğrulama', route: { page: 'verifications' }, show: canModerate(admin.role) },
    { label: 'Hesap ara', route: { page: 'user' }, show: true },
    { label: 'Denetim kaydı', route: { page: 'audit' }, show: canEnforce(admin.role) },
  ];
  const active = route.page === 'report' ? 'reports' : route.page;
  return (
    <nav className="sidebar" aria-label="Yönetim menüsü">
      <div className="brand">
        VIBE<small>Yönetim paneli</small>
      </div>
      {items
        .filter((i) => i.show)
        .map((item) => (
          <button
            key={item.label}
            className={`nav-item ${active === item.route.page ? 'active' : ''}`}
            onClick={() => navigate(item.route)}
          >
            {item.label}
          </button>
        ))}
      <div className="sidebar-footer">
        <span>
          {admin.email}
          <br />
          {ROLE[admin.role]}
        </span>
        <button className="btn" onClick={onLogout}>
          Çıkış yap
        </button>
      </div>
    </nav>
  );
}
