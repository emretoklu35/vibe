import type {
  AppConfigResponseDto,
  ConsentDecisionDto,
  ConsentStatesResponseDto,
  DeletionResponseDto,
  LegalDocumentResponseDto,
  MeDto,
  MeResponseDto,
} from '@vibe/api-contract';

import { authedRequest } from '@/features/session/session';

import { apiRequest } from './client';

export async function getAppConfig(): Promise<AppConfigResponseDto['data']> {
  return (await apiRequest<AppConfigResponseDto>('/app/config')).data;
}

export async function getLegalDocument(type: string): Promise<LegalDocumentResponseDto['data']> {
  return (
    await apiRequest<LegalDocumentResponseDto>(`/legal/documents/${encodeURIComponent(type)}`)
  ).data;
}

export async function getMe(): Promise<MeDto> {
  return (await authedRequest<MeResponseDto>('/users/me')).data;
}

export async function setBirthDate(birthDate: string): Promise<MeDto> {
  return (await authedRequest<MeResponseDto>('/users/me', { method: 'PATCH', json: { birthDate } }))
    .data;
}

export async function recordConsents(
  decisions: ConsentDecisionDto[],
): Promise<ConsentStatesResponseDto['data']> {
  return (
    await authedRequest<ConsentStatesResponseDto>('/privacy/consents', {
      method: 'POST',
      json: { decisions },
    })
  ).data;
}

export async function getConsents(): Promise<ConsentStatesResponseDto['data']> {
  return (await authedRequest<ConsentStatesResponseDto>('/privacy/consents')).data;
}

export async function requestAccountDeletion(): Promise<DeletionResponseDto['data']> {
  return (await authedRequest<DeletionResponseDto>('/users/me', { method: 'DELETE' })).data;
}

export async function restoreAccount(): Promise<void> {
  await authedRequest<void>('/users/me/restore', { method: 'POST' });
}
