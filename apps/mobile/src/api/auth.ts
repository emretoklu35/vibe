import type {
  RequestOtpResponseDto,
  SessionsResponseDto,
  SignInDataDto,
  SignInResponseDto,
} from '@vibe/api-contract';

import { authedRequest } from '@/features/session/session';
import { getDeviceId } from '@/lib/device-id';

import { apiRequest } from './client';

export async function requestOtp(phone: string): Promise<RequestOtpResponseDto['data']> {
  const res = await apiRequest<RequestOtpResponseDto>('/auth/otp/request', {
    method: 'POST',
    json: { phone },
  });
  return res.data;
}

export async function verifyOtp(phone: string, code: string): Promise<SignInDataDto> {
  const res = await apiRequest<SignInResponseDto>('/auth/otp/verify', {
    method: 'POST',
    json: { phone, code, deviceId: await getDeviceId() },
  });
  return res.data;
}

export async function listSessions(): Promise<SessionsResponseDto['data']> {
  return (await authedRequest<SessionsResponseDto>('/auth/sessions')).data;
}

export async function revokeSession(id: string): Promise<void> {
  await authedRequest<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
