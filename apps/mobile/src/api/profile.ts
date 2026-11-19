import type {
  CreatePhotoUploadDto,
  InterestDto,
  InterestsResponseDto,
  MyProfileDto,
  MyProfileResponseDto,
  PhotoDto,
  PhotoResponseDto,
  PhotosResponseDto,
  PhotoUploadDto,
  PhotoUploadResponseDto,
  PreferenceDto,
  PreferenceResponseDto,
  SetPreferencesDto,
  UpsertProfileDto,
} from '@vibe/api-contract';

import { authedRequest } from '@/features/session/session';

import { apiRequest } from './client';

export const getMyProfile = async (): Promise<MyProfileDto> =>
  (await authedRequest<MyProfileResponseDto>('/profiles/me')).data;

export const upsertProfile = async (input: UpsertProfileDto): Promise<MyProfileDto> =>
  (await authedRequest<MyProfileResponseDto>('/profiles/me', { method: 'PUT', json: input })).data;

export const listInterests = async (): Promise<InterestDto[]> =>
  (await apiRequest<InterestsResponseDto>('/interests')).data;

export const setInterests = async (interestIds: number[]): Promise<MyProfileDto> =>
  (
    await authedRequest<MyProfileResponseDto>('/profiles/me/interests', {
      method: 'PUT',
      json: { interestIds },
    })
  ).data;

export const getPreferences = async (): Promise<PreferenceDto | null> =>
  (await authedRequest<PreferenceResponseDto>('/profiles/me/preferences')).data;

export const setPreferences = async (input: SetPreferencesDto): Promise<PreferenceDto | null> =>
  (
    await authedRequest<PreferenceResponseDto>('/profiles/me/preferences', {
      method: 'PUT',
      json: input,
    })
  ).data;

export const listPhotos = async (): Promise<PhotoDto[]> =>
  (await authedRequest<PhotosResponseDto>('/profiles/me/photos')).data;

export const createPhotoUpload = async (input: CreatePhotoUploadDto): Promise<PhotoUploadDto> =>
  (
    await authedRequest<PhotoUploadResponseDto>('/profiles/me/photos/upload-url', {
      method: 'POST',
      json: input,
    })
  ).data;

export const completePhotoUpload = async (id: string): Promise<PhotoDto> =>
  (
    await authedRequest<PhotoResponseDto>(
      `/profiles/me/photos/${encodeURIComponent(id)}/complete`,
      { method: 'POST' },
    )
  ).data;

export const deletePhoto = (id: string) =>
  authedRequest<void>(`/profiles/me/photos/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const reorderPhotos = async (photoIds: string[]): Promise<PhotoDto[]> =>
  (
    await authedRequest<PhotosResponseDto>('/profiles/me/photos/order', {
      method: 'PATCH',
      json: { photoIds },
    })
  ).data;
