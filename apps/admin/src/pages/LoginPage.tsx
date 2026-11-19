import type { AdminLoginResponseDto } from '@vibe/api-contract';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';

import { api, errorText, session } from '../api';

export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const login = useMutation({
    mutationFn: () =>
      api<AdminLoginResponseDto>('/admin/auth/login', {
        method: 'POST',
        json: { email, password, totp },
      }),
    onSuccess: (res) => {
      session.set(res.data.token);
      onSignedIn();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <div className="login">
      <form className="card stack" onSubmit={submit} aria-labelledby="login-title">
        <div className="brand" id="login-title">
          VIBE<small>Yönetim paneli girişi</small>
        </div>
        <label>
          E-posta
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Parola
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Doğrulama kodu (kimlik doğrulama uygulaması)
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        {login.isError ? (
          <div className="error" role="alert">
            {errorText(login.error)}
          </div>
        ) : null}
        <button className="btn primary" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}
