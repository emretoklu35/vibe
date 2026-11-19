import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ChatService } from '../chat/chat.service.js';
import type { BlockedUserDto } from './dto/blocks.dto.js';

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  /**
   * Engelleme iki yönlü görünmezlik sağlar: keşfet, beğeni ve eşleşme listesi her iki tarafa da kapanır.
   * Aradaki aktif eşleşme ve sohbet aynı işlemde kapanır. İdempotenttir.
   */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CANNOT_TARGET_SELF,
        'Kendini engelleyemezsin',
      );
    }
    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, 'Kişi bulunamadı');

    const closed = await this.prisma.$transaction(async (tx) => {
      await tx.block.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      });
      const active = await tx.match.findFirst({
        where: {
          status: 'ACTIVE',
          OR: [
            { userAId: blockerId, userBId: blockedId },
            { userAId: blockedId, userBId: blockerId },
          ],
        },
        select: { id: true },
      });
      if (!active) return undefined;
      await tx.match.update({
        where: { id: active.id },
        data: { status: 'UNMATCHED', unmatchedById: blockerId, unmatchedAt: new Date() },
      });
      return this.chat.closeForMatch(tx, active.id);
    });
    if (closed) this.chat.emitClosed(closed, [blockerId, blockedId]);
  }

  /** Engeli kaldırır. Bitirilmiş eşleşme geri gelmez. */
  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
  }

  async list(blockerId: string): Promise<BlockedUserDto[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      select: {
        blockedId: true,
        createdAt: true,
        blocked: { select: { profile: { select: { displayName: true } } } },
      },
    });
    return rows.map((r) => ({
      userId: r.blockedId,
      displayName: r.blocked.profile?.displayName ?? null,
      blockedAt: r.createdAt,
    }));
  }
}
