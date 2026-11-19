import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import type { ConsentType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { findLegalDocument, LEGAL_DOCUMENTS, REQUIRED_DOCUMENTS } from './legal-documents.js';

export type ConsentDecision = { type: ConsentType; granted: boolean; textVersion: string };

export type ConsentState = {
  type: ConsentType;
  required: boolean;
  currentVersion: string;
  granted: boolean;
  grantedVersion: string | null;
  upToDate: boolean;
  updatedAt: Date | null;
};

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Her belge türü için en son kararı döndürür. */
  async getStates(userId: string): Promise<ConsentState[]> {
    const latest = await this.prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      distinct: ['type'],
      select: { type: true, granted: true, textVersion: true, createdAt: true },
    });
    return LEGAL_DOCUMENTS.map((doc) => {
      const record = latest.find((r) => r.type === doc.type);
      const granted = record?.granted ?? false;
      return {
        type: doc.type,
        required: doc.required,
        currentVersion: doc.version,
        granted,
        grantedVersion: granted ? (record?.textVersion ?? null) : null,
        upToDate: granted && record?.textVersion === doc.version,
        updatedAt: record?.createdAt ?? null,
      };
    });
  }

  async hasAllRequired(userId: string): Promise<boolean> {
    const states = await this.getStates(userId);
    return REQUIRED_DOCUMENTS.every((doc) => states.some((s) => s.type === doc.type && s.upToDate));
  }

  /** Belgenin güncel sürümü için verilmiş ve geri alınmamış rıza var mı? */
  async isGranted(userId: string, type: ConsentType): Promise<boolean> {
    const state = (await this.getStates(userId)).find((s) => s.type === type);
    return state?.upToDate ?? false;
  }

  /** Kararlar tek işlemde kaydedilir: biri geçersizse hiçbiri yazılmaz. */
  async record(userId: string, decisions: ConsentDecision[], ipAddress?: string): Promise<void> {
    for (const decision of decisions) {
      const doc = findLegalDocument(decision.type);
      if (!doc) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.CONSENT_TYPE_UNAVAILABLE,
          'Bu rıza türü henüz kullanılmıyor',
          { type: decision.type },
        );
      }
      if (decision.textVersion !== doc.version) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.CONSENT_VERSION_MISMATCH,
          'Metnin güncel olmayan bir sürümü onaylandı; lütfen metni yeniden açın',
          { type: decision.type, currentVersion: doc.version },
        );
      }
      if (doc.required && !decision.granted) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.CONSENT_REQUIRED_CANNOT_WITHDRAW,
          'Bu metin hizmetin kullanımı için zorunludur; vazgeçmek için hesabınızı silebilirsiniz',
          { type: decision.type },
        );
      }
    }

    const withdrawsOrientation = decisions.some(
      (d) => d.type === 'SPECIAL_CATEGORY_ORIENTATION' && !d.granted,
    );
    await this.prisma.$transaction([
      this.prisma.consentRecord.createMany({
        data: decisions.map((d) => ({
          userId,
          type: d.type,
          granted: d.granted,
          textVersion: d.textVersion,
          ipAddress: ipAddress?.slice(0, 64),
        })),
      }),
      // K7: rıza geri alınınca aranan cinsiyet bilgisi aynı işlemde silinir (keşfet durur).
      ...(withdrawsOrientation
        ? [this.prisma.preference.updateMany({ where: { userId }, data: { seekingGenders: [] } })]
        : []),
    ]);
  }
}
