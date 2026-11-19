import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { MessageType } from '../../../generated/prisma/enums.js';

export const MAX_MESSAGE_LENGTH = 2000;

export class SendMessageDto {
  @ApiProperty({
    format: 'uuid',
    description: 'İstemcinin ürettiği kimlik; tekrar gönderimde aynı mesaj döner',
  })
  @IsUUID()
  id!: string;

  @ApiProperty({ maxLength: MAX_MESSAGE_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_LENGTH)
  body!: string;
}

export class MarkReadDto {
  @ApiProperty({ format: 'uuid', description: 'Okunan en son mesaj' })
  @IsUUID()
  lastReadMessageId!: string;
}

export class CursorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

export class MessageDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  senderId!: string | null;

  @ApiProperty({ enum: MessageType, enumName: 'MessageType' })
  type!: MessageType;

  @ApiProperty({ description: 'Silinmiş mesajlarda boş' })
  body!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;
}

export class MessageResponseDto {
  @ApiProperty({ type: MessageDto })
  data!: MessageDto;
}

export class PageMetaDto {
  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export class MessagesResponseDto {
  @ApiProperty({ type: [MessageDto], description: 'En yeni önce' })
  data!: MessageDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ConversationUserDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  age!: number;

  @ApiProperty({ type: String, nullable: true })
  photoUrl!: string | null;
}

export class ConversationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  matchId!: string;

  @ApiProperty({ type: ConversationUserDto })
  otherUser!: ConversationUserDto;

  @ApiProperty({ type: MessageDto, nullable: true })
  lastMessage!: MessageDto | null;

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Karşı tarafın en son okuduğu an ("görüldü" için)',
  })
  otherLastReadAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class ConversationsResponseDto {
  @ApiProperty({ type: [ConversationDto] })
  data!: ConversationDto[];

  @ApiProperty({ type: PageMetaDto })
  meta!: PageMetaDto;
}

export class ConversationResponseDto {
  @ApiProperty({ type: ConversationDto })
  data!: ConversationDto;
}
