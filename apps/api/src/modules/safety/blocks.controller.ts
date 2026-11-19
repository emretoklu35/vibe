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
import { BlocksService } from './blocks.service.js';
import { BlocksResponseDto, BlockUserDto } from './dto/blocks.dto.js';

const byUser = (req: { auth?: AuthContext }) => req.auth?.userId;

@ApiTags('safety')
@ApiBearerAuth()
@Controller('safety/blocks')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ bucket: 'block-user', limit: 60, windowSeconds: 3600, key: byUser })
  @ApiOperation({ summary: 'Engelle (eşleşme varsa biter, iki taraf da birbirini görmez)' })
  @ApiNoContentResponse()
  async block(@CurrentAuth() auth: AuthContext, @Body() body: BlockUserDto): Promise<void> {
    await this.blocks.block(auth.userId, body.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Engellediğin kişiler' })
  @ApiOkResponse({ type: BlocksResponseDto })
  async list(@CurrentAuth() auth: AuthContext): Promise<BlocksResponseDto> {
    return { data: await this.blocks.list(auth.userId) };
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Engeli kaldır (eşleşme geri gelmez)' })
  @ApiNoContentResponse()
  async unblock(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.blocks.unblock(auth.userId, userId);
  }
}
