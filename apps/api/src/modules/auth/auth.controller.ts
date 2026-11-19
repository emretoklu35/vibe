import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { AllowDeletionPending, type AuthContext, CurrentAuth, Public } from './auth.decorators.js';
import { AuthService } from './auth.service.js';
import {
  RefreshDto,
  RequestOtpDto,
  RequestOtpResponseDto,
  SessionsResponseDto,
  SignInResponseDto,
  TokenPairResponseDto,
  VerifyOtpDto,
} from './dto/auth.dto.js';
import { OtpService } from './otp.service.js';
import { normalizeTurkishMobile } from './phone.js';
import { SessionsService } from './sessions.service.js';

/** Rate limit anahtarı: normalize edilmiş numara (anahtarda yalnızca özeti tutulur). */
const phoneKey = (req: Request) => normalizeTurkishMobile((req.body as { phone?: unknown })?.phone);

function requirePhone(raw: string): string {
  const e164 = normalizeTurkishMobile(raw);
  if (!e164) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.INVALID_PHONE,
      'Geçerli bir Türkiye cep telefonu numarası girin',
    );
  }
  return e164;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('otp/request')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  // SMS maliyetli ve kötüye kullanılabilir: Redis'e ulaşılamazsa istek reddedilir (failClosed).
  @RateLimit(
    { bucket: 'otp-request-ip', limit: 10, windowSeconds: 3600, failClosed: true },
    { bucket: 'otp-request-phone', limit: 3, windowSeconds: 900, key: phoneKey, failClosed: true },
    {
      bucket: 'otp-request-cooldown',
      limit: 1,
      windowSeconds: 60,
      key: phoneKey,
      failClosed: true,
    },
  )
  @ApiOperation({
    summary: 'SMS doğrulama kodu gönder',
    description:
      'Numara kayıtlı olsun ya da olmasın aynı yanıt döner (numaranın varlığı sızdırılmaz). Aynı numaraya 60 sn içinde ikinci kod gönderilmez.',
  })
  @ApiAcceptedResponse({ type: RequestOtpResponseDto })
  async requestOtp(@Body() body: RequestOtpDto): Promise<RequestOtpResponseDto> {
    return { data: await this.otp.issue(requirePhone(body.phone)) };
  }

  @Post('otp/verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'otp-verify-ip', limit: 30, windowSeconds: 3600, failClosed: true })
  @ApiOperation({ summary: 'Kodu doğrula; giriş yap veya hesap oluştur' })
  @ApiOkResponse({ type: SignInResponseDto })
  async verifyOtp(@Body() body: VerifyOtpDto, @Req() req: Request): Promise<SignInResponseDto> {
    const result = await this.auth.signIn(requirePhone(body.phone), body.code, {
      deviceId: body.deviceId,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      port: req.socket.remotePort,
    });
    return { data: result };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'refresh-ip', limit: 60, windowSeconds: 60 })
  @ApiOperation({
    summary: 'Token yenile (rotasyon)',
    description:
      'Her çağrıda yeni refresh token döner; eskisi geçersizleşir. Eski token tekrar kullanılırsa oturum iptal edilir (REFRESH_TOKEN_REUSED).',
  })
  @ApiOkResponse({ type: TokenPairResponseDto })
  async refresh(@Body() body: RefreshDto): Promise<TokenPairResponseDto> {
    return { data: await this.sessions.rotate(body.refreshToken) };
  }

  @Post('logout')
  @ApiBearerAuth()
  @AllowDeletionPending()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bu oturumu kapat' })
  @ApiNoContentResponse()
  async logout(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.sessions.revoke(auth.sessionId, auth.userId, 'logout');
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Açık oturumlar' })
  @ApiOkResponse({ type: SessionsResponseDto })
  async listSessions(@CurrentAuth() auth: AuthContext): Promise<SessionsResponseDto> {
    const sessions = await this.sessions.listActive(auth.userId);
    return { data: sessions.map((s) => ({ ...s, current: s.id === auth.sessionId })) };
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bir oturumu uzaktan kapat' })
  @ApiNoContentResponse()
  async revokeSession(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const revoked = await this.sessions.revoke(id, auth.userId, 'revoked_by_user');
    if (!revoked)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Oturum bulunamadı');
  }
}
