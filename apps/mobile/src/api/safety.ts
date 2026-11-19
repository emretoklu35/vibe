import type {
  CreateReportDto,
  ExportStatusDto,
  ExportStatusResponseDto,
  ReportCreatedResponseDto,
  SelfieUploadResponseDto,
  VerificationStatusDto,
  VerificationStatusResponseDto,
} from '@vibe/api-contract';

import { authedRequest } from '@/features/session/session';

export const createReport = async (input: CreateReportDto) =>
  (
    await authedRequest<ReportCreatedResponseDto>('/safety/reports', {
      method: 'POST',
      json: input,
    })
  ).data;

export const getVerification = async (): Promise<VerificationStatusDto> =>
  (await authedRequest<VerificationStatusResponseDto>('/safety/verification')).data;

export const createSelfieUpload = async (sizeBytes: number) =>
  (
    await authedRequest<SelfieUploadResponseDto>('/safety/verification/upload-url', {
      method: 'POST',
      json: { contentType: 'image/jpeg', sizeBytes },
    })
  ).data;

export const submitVerification = async (id: string): Promise<VerificationStatusDto> =>
  (
    await authedRequest<VerificationStatusResponseDto>(
      `/safety/verification/${encodeURIComponent(id)}/submit`,
      { method: 'POST', timeoutMs: 30_000 },
    )
  ).data;

export const requestDataExport = async (): Promise<ExportStatusDto | null> =>
  (await authedRequest<ExportStatusResponseDto>('/privacy/export', { method: 'POST' })).data;

export const getDataExport = async (): Promise<ExportStatusDto | null> =>
  (await authedRequest<ExportStatusResponseDto>('/privacy/export')).data;
