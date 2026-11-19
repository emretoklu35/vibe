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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import {
  LikeResponseDto,
  MatchDetailResponseDto,
  MatchesQueryDto,
  MatchesResponseDto,
  TargetUserDto,
} from './dto/matching.dto.js';
import { MatchingService } from './matching.service.js';

const byUser = (req: { auth?: AuthContext }) => req.auth?.userId;

@ApiTags('matching')
@ApiBearerAuth()
@Controller()
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post('likes')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'like-user', limit: 60, windowSeconds: 60, key: byUser })
  @ApiOperation({
    summary: 'Beğen',
    description:
      'Karşılıklıysa eşleşme oluşur (matched=true). İdempotenttir. Keşfette görünmeyen kişi için 404.',
  })
  @ApiOkResponse({ type: LikeResponseDto })
  async like(
    @CurrentAuth() auth: AuthContext,
    @Body() body: TargetUserDto,
  ): Promise<LikeResponseDto> {
    return { data: await this.matching.like(auth.userId, body.targetUserId) };
  }

  @Post('passes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ bucket: 'pass-user', limit: 120, windowSeconds: 60, key: byUser })
  @ApiOperation({ summary: 'Geç (kişi 30 gün gösterilmez)' })
  @ApiNoContentResponse()
  async pass(@CurrentAuth() auth: AuthContext, @Body() body: TargetUserDto): Promise<void> {
    await this.matching.pass(auth.userId, body.targetUserId);
  }

  @Get('matches')
  @ApiOperation({ summary: 'Aktif eşleşmeler (en yeni önce, sayfalı)' })
  @ApiOkResponse({ type: MatchesResponseDto })
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MatchesQueryDto,
  ): Promise<MatchesResponseDto> {
    const { items, nextCursor } = await this.matching.list(auth.userId, query.cursor);
    return { data: items, meta: { nextCursor } };
  }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Eşleşme ayrıntısı ve karşı tarafın profili' })
  @ApiOkResponse({ type: MatchDetailResponseDto })
  async detail(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MatchDetailResponseDto> {
    return { data: await this.matching.detail(auth.userId, id) };
  }

  @Delete('matches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eşleşmeyi bitir (geri alınamaz; kişi bir daha önerilmez)' })
  @ApiNoContentResponse()
  async unmatch(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.matching.unmatch(auth.userId, id);
  }
}
