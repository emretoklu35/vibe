import type {
  BlockedUserDto,
  BlocksResponseDto,
  CandidatesResponseDto,
  DiscoveryStatusDto,
  DiscoveryStatusResponseDto,
  LikeResponseDto,
  LikeResultDto,
  LocationUpdatedResponseDto,
  MatchDetailDto,
  MatchDetailResponseDto,
  MatchesResponseDto,
  ProfileCardDto,
} from '@vibe/api-contract';

import { authedRequest } from '@/features/session/session';

export const getDiscoveryStatus = async (): Promise<DiscoveryStatusDto> =>
  (await authedRequest<DiscoveryStatusResponseDto>('/discovery/status')).data;

export const getCandidates = async (limit = 10): Promise<ProfileCardDto[]> =>
  (await authedRequest<CandidatesResponseDto>(`/discovery/candidates?limit=${limit}`)).data;

export const likeUser = async (targetUserId: string): Promise<LikeResultDto> =>
  (await authedRequest<LikeResponseDto>('/likes', { method: 'POST', json: { targetUserId } })).data;

export const passUser = (targetUserId: string) =>
  authedRequest<void>('/passes', { method: 'POST', json: { targetUserId } });

export const listMatches = (cursor?: string) =>
  authedRequest<MatchesResponseDto>(
    `/matches${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  );

export const getMatch = async (id: string): Promise<MatchDetailDto> =>
  (await authedRequest<MatchDetailResponseDto>(`/matches/${encodeURIComponent(id)}`)).data;

export const unmatch = (id: string) =>
  authedRequest<void>(`/matches/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const blockUser = (userId: string) =>
  authedRequest<void>('/safety/blocks', { method: 'POST', json: { userId } });

export const unblockUser = (userId: string) =>
  authedRequest<void>(`/safety/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const listBlocks = async (): Promise<BlockedUserDto[]> =>
  (await authedRequest<BlocksResponseDto>('/safety/blocks')).data;

export const sendLocation = async (latitude: number, longitude: number) =>
  (
    await authedRequest<LocationUpdatedResponseDto>('/profiles/me/location', {
      method: 'PUT',
      json: { latitude, longitude },
    })
  ).data;
