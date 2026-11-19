import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ageOn, toCalendarDate, todayInTurkey } from '../users/age.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import type { ConversationDto, MessageDto } from './dto/chat.dto.js';

const MESSAGES_PAGE = 30;
const CONVERSATIONS_PAGE = 30;

type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM';
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
};

export function toMessageDto(row: MessageRow): MessageDto {
  return { ...row, body: row.deletedAt ? '' : row.body };
}

const notFound = () =>
  new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Sohbet bulunamadı');

type ConversationRow = {
  id: string;
  matchId: string;
  createdAt: Date;
  sortAt: Date;
  otherUserId: string;
  otherLastReadAt: Date | null;
  unreadCount: number;
};

/**
 * Sohbetler eşleşmeden doğar. Erişim kuralı: kullanıcı katılımcı (leftAt boş), eşleşme aktif,
 * karşı taraf katılımcı ve hesabı aktif. Aksi her durumda 404 (varlık sızdırılmaz).
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Eşleşme işlemi içinde çağrılır: sohbeti ve iki katılımcıyı oluşturur. */
  async openForMatch(
    tx: Prisma.TransactionClient,
    matchId: string,
    userIds: [string, string],
  ): Promise<string> {
    const conversation = await tx.conversation.create({
      data: { matchId, participants: { create: userIds.map((userId) => ({ userId })) } },
      select: { id: true },
    });
    return conversation.id;
  }

  /** Eşleşme bitince / engellenince çağrılır: iki taraf da sohbetten ayrılır. Mesajlar silinmez (şikayet kanıtı). */
  async closeForMatch(tx: Prisma.TransactionClient, matchId: string): Promise<string | undefined> {
    const conversation = await tx.conversation.findUnique({
      where: { matchId },
      select: { id: true },
    });
    if (!conversation) return undefined;
    await tx.conversationParticipant.updateMany({
      where: { conversationId: conversation.id, leftAt: null },
      data: { leftAt: new Date() },
    });
    return conversation.id;
  }

  emitClosed(conversationId: string, userIds: string[]): void {
    this.realtime.emitToUsers(userIds, RealtimeEvent.CONVERSATION_CLOSED, { conversationId });
  }

  async list(
    userId: string,
    cursor?: string,
  ): Promise<{ items: ConversationDto[]; nextCursor: string | null }> {
    const after = decodeCursor(cursor);
    const afterClause = after
      ? Prisma.sql`AND (COALESCE(c."lastMessageAt", c."createdAt"), c."id") < (${after.at}, ${after.id}::uuid)`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<ConversationRow[]>`
      SELECT
        c."id", c."matchId", c."createdAt",
        COALESCE(c."lastMessageAt", c."createdAt") AS "sortAt",
        other."userId" AS "otherUserId",
        other."lastReadAt" AS "otherLastReadAt",
        (
          SELECT count(*)::int FROM "Message" m
          WHERE m."conversationId" = c."id"
            AND m."senderId" IS NOT NULL AND m."senderId" <> me."userId"
            AND m."deletedAt" IS NULL
            AND m."createdAt" > COALESCE(me."lastReadAt", 'epoch'::timestamp)
        ) AS "unreadCount"
      FROM "ConversationParticipant" me
      JOIN "Conversation" c ON c."id" = me."conversationId"
      JOIN "Match" mt ON mt."id" = c."matchId" AND mt."status" = 'ACTIVE'
      JOIN "ConversationParticipant" other
        ON other."conversationId" = c."id" AND other."userId" <> me."userId" AND other."leftAt" IS NULL
      JOIN "User" ou ON ou."id" = other."userId" AND ou."status" = 'ACTIVE'
      WHERE me."userId" = ${userId}::uuid AND me."leftAt" IS NULL
      ${afterClause}
      ORDER BY "sortAt" DESC, c."id" DESC
      LIMIT ${CONVERSATIONS_PAGE + 1}`;

    const page = rows.slice(0, CONVERSATIONS_PAGE);
    const items = await this.toConversationDtos(page);
    const last = page[page.length - 1];
    return {
      items,
      nextCursor:
        rows.length > CONVERSATIONS_PAGE && last ? encodeCursor(last.sortAt, last.id) : null,
    };
  }

  async get(userId: string, conversationId: string): Promise<ConversationDto> {
    const { otherUserId } = await this.assertAccess(userId, conversationId);
    const [conversation, other, me] = await Promise.all([
      this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } }),
      this.prisma.conversationParticipant.findUniqueOrThrow({
        where: { conversationId_userId: { conversationId, userId: otherUserId } },
      }),
      this.prisma.conversationParticipant.findUniqueOrThrow({
        where: { conversationId_userId: { conversationId, userId } },
      }),
    ]);
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: otherUserId,
        deletedAt: null,
        createdAt: { gt: me.lastReadAt ?? new Date(0) },
      },
    });
    const [dto] = await this.toConversationDtos([
      {
        id: conversation.id,
        matchId: conversation.matchId,
        createdAt: conversation.createdAt,
        sortAt: conversation.lastMessageAt ?? conversation.createdAt,
        otherUserId,
        otherLastReadAt: other.lastReadAt,
        unreadCount,
      },
    ]);
    return dto!;
  }

  async messages(
    userId: string,
    conversationId: string,
    cursor?: string,
  ): Promise<{ items: MessageDto[]; nextCursor: string | null }> {
    await this.assertAccess(userId, conversationId);
    const after = decodeCursor(cursor);
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(after
          ? { OR: [{ createdAt: { lt: after.at } }, { createdAt: after.at, id: { lt: after.id } }] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MESSAGES_PAGE + 1,
    });
    const page = rows.slice(0, MESSAGES_PAGE);
    const last = page[page.length - 1];
    return {
      items: page.map(toMessageDto),
      nextCursor:
        rows.length > MESSAGES_PAGE && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /**
   * Mesaj gönder. İstemci kimliği (UUID) ile idempotenttir: aynı istek tekrarlanırsa aynı mesaj döner.
   * Mesaj metni loglanmaz ve push bildiriminde yer almaz.
   */
  async send(
    userId: string,
    conversationId: string,
    input: { id: string; body: string },
  ): Promise<MessageDto> {
    const body = input.body.trim();
    if (body.length === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.EMPTY_MESSAGE,
        'Boş mesaj gönderilemez',
      );
    }
    const { otherUserId } = await this.assertAccess(userId, conversationId);

    const existing = await this.prisma.message.findUnique({ where: { id: input.id } });
    if (existing) return this.idempotentResult(existing, userId, conversationId);

    let message: MessageRow;
    try {
      message = await this.prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: { id: input.id, conversationId, senderId: userId, type: 'TEXT', body },
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: created.createdAt },
        });
        await tx.conversationParticipant.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { lastReadAt: created.createdAt },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.message.findUniqueOrThrow({ where: { id: input.id } });
        return this.idempotentResult(raced, userId, conversationId);
      }
      throw error;
    }

    const dto = toMessageDto(message);
    this.realtime.emitToUsers([userId, otherUserId], RealtimeEvent.MESSAGE_NEW, dto);
    await this.notifications.notify({ userId: otherUserId, kind: 'NEW_MESSAGE', conversationId });
    return dto;
  }

  /** Okundu bilgisi yalnızca ileri gider (eski bir mesajla geri alınamaz). */
  async markRead(userId: string, conversationId: string, lastReadMessageId: string): Promise<void> {
    const { otherUserId } = await this.assertAccess(userId, conversationId);
    const message = await this.prisma.message.findFirst({
      where: { id: lastReadMessageId, conversationId },
      select: { createdAt: true },
    });
    if (!message)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Mesaj bulunamadı');
    const { count } = await this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId,
        OR: [{ lastReadAt: null }, { lastReadAt: { lt: message.createdAt } }],
      },
      data: { lastReadAt: message.createdAt },
    });
    if (count > 0) {
      this.realtime.emitToUsers([otherUserId, userId], RealtimeEvent.CONVERSATION_READ, {
        conversationId,
        userId,
        readAt: message.createdAt,
      });
    }
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string): Promise<void> {
    const { otherUserId } = await this.assertAccess(userId, conversationId);
    const { count } = await this.prisma.message.updateMany({
      where: { id: messageId, conversationId, senderId: userId, deletedAt: null },
      data: { deletedAt: new Date(), body: '' },
    });
    if (count === 0)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Mesaj bulunamadı');
    this.realtime.emitToUsers([userId, otherUserId], RealtimeEvent.MESSAGE_DELETED, {
      conversationId,
      messageId,
    });
  }

  private idempotentResult(
    existing: MessageRow,
    userId: string,
    conversationId: string,
  ): MessageDto {
    if (existing.senderId !== userId || existing.conversationId !== conversationId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.MESSAGE_ID_CONFLICT,
        'Mesaj kimliği zaten kullanılmış',
      );
    }
    return toMessageDto(existing);
  }

  private async assertAccess(
    userId: string,
    conversationId: string,
  ): Promise<{ otherUserId: string }> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        match: { status: 'ACTIVE' },
        participants: { some: { userId, leftAt: null } },
      },
      select: {
        participants: {
          where: { userId: { not: userId }, leftAt: null, user: { status: 'ACTIVE' } },
          select: { userId: true },
        },
      },
    });
    const other = conversation?.participants[0];
    if (!other) throw notFound();
    return { otherUserId: other.userId };
  }

  private async toConversationDtos(rows: ConversationRow[]): Promise<ConversationDto[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [lastMessages, users] = await Promise.all([
      this.prisma.$queryRaw<MessageRow[]>`
        SELECT DISTINCT ON ("conversationId")
          "id", "conversationId", "senderId", "type"::text AS "type", "body", "createdAt", "deletedAt"
        FROM "Message"
        WHERE "conversationId" = ANY(${ids}::uuid[])
        ORDER BY "conversationId", "createdAt" DESC, "id" DESC`,
      this.prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.otherUserId) } },
        select: {
          id: true,
          birthDate: true,
          profile: { select: { displayName: true } },
          photos: {
            where: { status: 'APPROVED' },
            orderBy: { position: 'asc' },
            take: 1,
            select: { storageKey: true },
          },
        },
      }),
    ]);
    const today = todayInTurkey();
    return Promise.all(
      rows.map(async (row) => {
        const user = users.find((u) => u.id === row.otherUserId);
        const last = lastMessages.find((m) => m.conversationId === row.id);
        const photo = user?.photos[0];
        return {
          id: row.id,
          matchId: row.matchId,
          createdAt: row.createdAt,
          otherUser: {
            userId: row.otherUserId,
            displayName: user?.profile?.displayName ?? '',
            age: user?.birthDate ? ageOn(toCalendarDate(user.birthDate), today) : 0,
            photoUrl: photo ? await this.storage.presignDownload(photo.storageKey, 600) : null,
          },
          lastMessage: last ? toMessageDto(last) : null,
          unreadCount: row.unreadCount,
          otherLastReadAt: row.otherLastReadAt,
        };
      }),
    );
  }
}
