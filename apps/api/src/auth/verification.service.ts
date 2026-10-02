import { Injectable } from '@nestjs/common';
import { CryptoService } from '../common/crypto.service.js';
import { TokenPurpose } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const RESET_TTL_MS = 30 * 60 * 1000;

/** Password-reset tokens, stored only as keyed hashes. */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async issueResetToken(userId: string): Promise<string> {
    const token = this.crypto.randomToken();
    await this.prisma.$transaction([
      this.prisma.verificationToken.deleteMany({ where: { userId, purpose: TokenPurpose.PASSWORD_RESET, usedAt: null } }),
      this.prisma.verificationToken.create({
        data: {
          userId,
          purpose: TokenPurpose.PASSWORD_RESET,
          tokenHash: this.crypto.hash(token),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      }),
    ]);
    return token;
  }

  /** Returns the user id the token belongs to and marks it used, or null if invalid. */
  async consumeResetToken(token: string): Promise<string | null> {
    const record = await this.prisma.verificationToken.findFirst({
      where: { tokenHash: this.crypto.hash(token), purpose: TokenPurpose.PASSWORD_RESET, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) return null;
    const { count } = await this.prisma.verificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1 ? record.userId : null;
  }
}
