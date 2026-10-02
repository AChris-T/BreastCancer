import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SessionView } from '@breastscan/shared';
import { AuditService } from '../audit/audit.service.js';
import { CryptoService } from '../common/crypto.service.js';
import type { RequestContext } from '../common/request-context.js';
import type { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from './guards.js';

export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCESS_TTL_SECONDS = 15 * 60;

export interface IssuedTokens {
  accessToken: string;
  /** `<sessionId>.<secret>`; goes into the httpOnly cookie, never into JSON. */
  refreshToken: string;
  sessionId: string;
}

/**
 * Refresh tokens rotate on every use. The database stores only a keyed hash
 * of the current secret, so presenting an older secret for a live session
 * means the token was copied: the whole family of sessions is revoked.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async create(user: { id: string; role: Role }, context: RequestContext): Promise<IssuedTokens> {
    const secret = this.crypto.randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshHash: this.crypto.hash(secret),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return {
      accessToken: this.signAccess(user, session.id),
      refreshToken: `${session.id}.${secret}`,
      sessionId: session.id,
    };
  }

  async rotate(refreshToken: string | undefined): Promise<IssuedTokens & { userId: string }> {
    const parsed = parse(refreshToken);
    if (!parsed) throw new UnauthorizedException('Session expired. Please sign in again.');

    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { user: { select: { id: true, role: true, deletedAt: true } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.deletedAt) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (!this.crypto.hashEquals(parsed.secret, session.refreshHash)) {
      await this.revokeAll(session.userId);
      await this.audit.log({ action: 'REFRESH_TOKEN_REUSE', userId: session.userId, entityType: 'Session', entityId: session.id });
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const secret = this.crypto.randomToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshHash: this.crypto.hash(secret), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return {
      accessToken: this.signAccess(session.user, session.id),
      refreshToken: `${session.id}.${secret}`,
      sessionId: session.id,
      userId: session.userId,
    };
  }

  /** Revokes the session a refresh token belongs to; returns its user id if found. */
  async revokeByToken(refreshToken: string | undefined): Promise<string | null> {
    const parsed = parse(refreshToken);
    if (!parsed) return null;
    const session = await this.prisma.session.findUnique({ where: { id: parsed.sessionId } });
    if (!session || !this.crypto.hashEquals(parsed.secret, session.refreshHash)) return null;
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return session.userId;
  }

  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  async revokeAll(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  async list(userId: string, currentSessionId: string): Promise<SessionView[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  private signAccess(user: { id: string; role: Role }, sessionId: string): string {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, sid: sessionId };
    return this.jwt.sign(payload, { expiresIn: ACCESS_TTL_SECONDS });
  }
}

function parse(token: string | undefined): { sessionId: string; secret: string } | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
}
