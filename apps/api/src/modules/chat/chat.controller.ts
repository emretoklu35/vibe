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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RateLimit } from '../../common/rate-limit/rate-limit.decorator.js';
import { type AuthContext, CurrentAuth } from '../auth/auth.decorators.js';
import { ChatService } from './chat.service.js';
import {
  ConversationResponseDto,
  ConversationsResponseDto,
  CursorQueryDto,
  MarkReadDto,
  MessageResponseDto,
  MessagesResponseDto,
  SendMessageDto,
} from './dto/chat.dto.js';

const byUser = (req: { auth?: AuthContext }) => req.auth?.userId;

@ApiTags('chat')
@ApiBearerAuth()
@Controller('conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Sohbetler (son mesaja göre, okunmamış sayısıyla)' })
  @ApiOkResponse({ type: ConversationsResponseDto })
  async list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CursorQueryDto,
  ): Promise<ConversationsResponseDto> {
    const { items, nextCursor } = await this.chat.list(auth.userId, query.cursor);
    return { data: items, meta: { nextCursor } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tek sohbet' })
  @ApiOkResponse({ type: ConversationResponseDto })
  async get(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ConversationResponseDto> {
    return { data: await this.chat.get(auth.userId, id) };
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Mesajlar (en yeni önce, sayfalı)' })
  @ApiOkResponse({ type: MessagesResponseDto })
  async messages(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CursorQueryDto,
  ): Promise<MessagesResponseDto> {
    const { items, nextCursor } = await this.chat.messages(auth.userId, id, query.cursor);
    return { data: items, meta: { nextCursor } };
  }

  @Post(':id/messages')
  @RateLimit({ bucket: 'message-user', limit: 30, windowSeconds: 60, key: byUser })
  @ApiOperation({
    summary: 'Mesaj gönder',
    description:
      'İstemci kimliği (id) ile idempotenttir. Alıcı çevrimdışıysa metin içermeyen bir push gönderilir.',
  })
  @ApiCreatedResponse({ type: MessageResponseDto })
  async send(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return { data: await this.chat.send(auth.userId, id, body) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Okundu bilgisi' })
  @ApiNoContentResponse()
  async read(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: MarkReadDto,
  ): Promise<void> {
    await this.chat.markRead(auth.userId, id, body.lastReadMessageId);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Kendi mesajını sil (iki taraftan da kalkar)' })
  @ApiNoContentResponse()
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
  ): Promise<void> {
    await this.chat.deleteMessage(auth.userId, id, messageId);
  }
}
