import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import { DiscoveryService } from './discovery.service.js';
import {
  CandidatesQueryDto,
  CandidatesResponseDto,
  DiscoveryStatusResponseDto,
} from './dto/discovery.dto.js';

@ApiTags('discovery')
@ApiBearerAuth()
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('status')
  @ApiOperation({ summary: 'Keşfet açık mı; değilse eksikler' })
  @ApiOkResponse({ type: DiscoveryStatusResponseDto })
  async status(@CurrentAuth() auth: AuthContext): Promise<DiscoveryStatusResponseDto> {
    return { data: await this.discovery.status(auth.userId) };
  }

  @Get('candidates')
  @ApiOperation({
    summary: 'Aday kartları (uyum puanına göre sıralı)',
    description:
      'Keşfet hazır değilse 409 DISCOVERY_NOT_READY. Beğenilen, geçilen (30 gün) ve eşleşilen kişiler tekrar gelmez.',
  })
  @ApiOkResponse({ type: CandidatesResponseDto })
  async candidates(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CandidatesQueryDto,
  ): Promise<CandidatesResponseDto> {
    return { data: await this.discovery.candidates(auth.userId, query.limit ?? 10) };
  }
}
