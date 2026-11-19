import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { Public } from '../auth/auth.decorators.js';
import { type AdminContext, AdminAuthService } from './auth/admin-auth.service.js';
import { AdminGuard, AdminRoles, CurrentAdmin, Roles } from './auth/admin.guard.js';
import {
  AdminLoginDto,
  AdminLoginResponseDto,
  AdminMeResponseDto,
  AdminUserResponseDto,
  AuditLogsResponseDto,
  DecisionDto,
  ReportDetailResponseDto,
  ReportsQueryDto,
  ReportsResponseDto,
  ReviewPhotosResponseDto,
  UpdateReportDto,
  UserActionDto,
  VerificationsResponseDto,
} from './dto/admin.dto.js';
import { ModerationService } from './moderation.service.js';

const byEmail = (req: { body?: { email?: unknown } }) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;

/** Yönetici girişi. Kullanıcı guard'ı bu uçları atlar (@Public); yönetici kimliği ayrı doğrulanır. */
@ApiTags('admin')
@Public()
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit(
    { bucket: 'admin-login-ip', limit: 10, windowSeconds: 900, failClosed: true },
    { bucket: 'admin-login-email', limit: 5, windowSeconds: 900, key: byEmail, failClosed: true },
  )
  @ApiOperation({ summary: 'Yönetici girişi (e-posta + parola + TOTP)' })
  @ApiOkResponse({ type: AdminLoginResponseDto })
  async login(@Body() body: AdminLoginDto, @Ip() ip: string): Promise<AdminLoginResponseDto> {
    return { data: await this.auth.login(body.email, body.password, body.totp, ip) };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @AdminRoles(Roles.READ)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AdminMeResponseDto })
  me(@CurrentAdmin() admin: AdminContext): AdminMeResponseDto {
    return { data: { id: admin.adminId, email: admin.email, role: admin.role } };
  }

  @Post('logout')
  @UseGuards(AdminGuard)
  @AdminRoles(Roles.READ)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async logout(@CurrentAdmin() admin: AdminContext, @Ip() ip: string): Promise<void> {
    await this.auth.logout(admin, ip);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Public()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('reports')
  @AdminRoles(Roles.READ)
  @ApiOperation({ summary: 'Şikayet kuyruğu (öncelik sırasıyla)' })
  @ApiOkResponse({ type: ReportsResponseDto })
  async reports(@Query() query: ReportsQueryDto): Promise<ReportsResponseDto> {
    return { data: await this.moderation.listReports(query.status) };
  }

  @Get('reports/:id')
  @AdminRoles(Roles.READ)
  @ApiOkResponse({ type: ReportDetailResponseDto })
  async report(@Param('id', new ParseUUIDPipe()) id: string): Promise<ReportDetailResponseDto> {
    return { data: await this.moderation.getReport(id) };
  }

  @Patch('reports/:id')
  @AdminRoles(Roles.MODERATE)
  @ApiOperation({ summary: 'Şikayet durumunu güncelle' })
  @ApiOkResponse({ type: ReportDetailResponseDto })
  async updateReport(
    @CurrentAdmin() admin: AdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateReportDto,
    @Ip() ip: string,
  ): Promise<ReportDetailResponseDto> {
    return { data: await this.moderation.updateReport(admin, id, body.status, body.note, ip) };
  }

  @Get('moderation/photos')
  @AdminRoles(Roles.MODERATE)
  @ApiOperation({ summary: 'İnceleme bekleyen fotoğraflar' })
  @ApiOkResponse({ type: ReviewPhotosResponseDto })
  async photos(): Promise<ReviewPhotosResponseDto> {
    return { data: await this.moderation.photosForReview() };
  }

  @Post('moderation/photos/:id')
  @AdminRoles(Roles.MODERATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async decidePhoto(
    @CurrentAdmin() admin: AdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DecisionDto,
    @Ip() ip: string,
  ): Promise<void> {
    await this.moderation.decidePhoto(admin, id, body.decision, ip);
  }

  @Get('verifications')
  @AdminRoles(Roles.MODERATE)
  @ApiOperation({ summary: 'İnceleme bekleyen selfie doğrulamaları' })
  @ApiOkResponse({ type: VerificationsResponseDto })
  async verifications(): Promise<VerificationsResponseDto> {
    return { data: await this.moderation.verificationsForReview() };
  }

  @Post('verifications/:id')
  @AdminRoles(Roles.MODERATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async decideVerification(
    @CurrentAdmin() admin: AdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DecisionDto,
    @Ip() ip: string,
  ): Promise<void> {
    await this.moderation.decideVerification(admin, id, body.decision, body.note, ip);
  }

  @Get('users/:id')
  @AdminRoles(Roles.READ)
  @ApiOperation({
    summary: 'Hesap özeti (mesaj içerikleri yok; yalnızca şikayet kanıtında görülebilir)',
  })
  @ApiOkResponse({ type: AdminUserResponseDto })
  async user(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminUserResponseDto> {
    return { data: await this.moderation.getUser(id) };
  }

  @Post('users/:id/actions')
  @AdminRoles(Roles.MODERATE)
  @ApiOperation({ summary: 'Hesap işlemi (askıya alma/ban/geri açma yalnızca ADMIN)' })
  @ApiOkResponse({ type: AdminUserResponseDto })
  async act(
    @CurrentAdmin() admin: AdminContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UserActionDto,
    @Ip() ip: string,
  ): Promise<AdminUserResponseDto> {
    const enforcement = ['SUSPEND', 'BAN', 'RESTORE'].includes(body.action);
    if (enforcement && !(Roles.ENFORCE as readonly string[]).includes(admin.role)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ADMIN_FORBIDDEN,
        'Bu işlem için yetkin yok',
      );
    }
    return {
      data: await this.moderation.actOnUser(admin, id, body.action, body.reason, body.days, ip),
    };
  }

  @Get('audit-logs')
  @AdminRoles(Roles.ENFORCE)
  @ApiOperation({ summary: 'Denetim kaydı (son 100)' })
  @ApiOkResponse({ type: AuditLogsResponseDto })
  async auditLogs(): Promise<AuditLogsResponseDto> {
    return { data: await this.moderation.auditLogs() };
  }
}
