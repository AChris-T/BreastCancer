import { BadRequestException, ConflictException, ForbiddenException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { CONSENT_VERSIONS, ErrorCode, type AuthUser } from '@breastscan/shared';
import { AuditService } from '../audit/audit.service.js';
import { CodedException } from '../common/errors.js';
import type { RequestContext } from '../common/request-context.js';
import { AppConfig } from '../config/config.module.js';
import { ConsentType, type User } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from './password.js';
import { type IssuedTokens, SessionsService } from './sessions.service.js';
import { VerificationService } from './verification.service.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
const GENERIC_RESET_MESSAGE = 'If an account exists for that email, we have sent a reset link.';

/** Signing up means agreeing to these; the sign-up page says so next to the button. */
const SIGN_UP_CONSENTS = [ConsentType.TERMS, ConsentType.PRIVACY, ConsentType.HEALTH_DATA];

export interface LoginResult extends IssuedTokens {
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly verification: VerificationService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  /** Creates a ready-to-use account and signs the user in straight away. */
  async register(dto: RegisterDto, context: RequestContext): Promise<LoginResult> {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('An account with this email already exists. Try signing in.');
    }
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await hashPassword(dto.password),
        emailVerifiedAt: now,
        onboardingCompletedAt: now,
        lastLoginAt: now,
        profile: { create: { firstName: dto.firstName, lastName: dto.lastName } },
        consents: {
          create: SIGN_UP_CONSENTS.map((type) => ({
            type,
            granted: true,
            version: CONSENT_VERSIONS[type],
            ipAddress: context.ipAddress,
          })),
        },
      },
    });
    await this.audit.log({ action: 'USER_REGISTERED', userId: user.id, entityType: 'User', entityId: user.id, context });
    const tokens = await this.sessions.create(user, context);
    return { ...tokens, user: await this.me(user.id) };
  }

  async login(dto: LoginDto, context: RequestContext): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt) {
      await burnPasswordCheck(dto.password);
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new CodedException(
        HttpStatus.TOO_MANY_REQUESTS,
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
        ErrorCode.ACCOUNT_LOCKED,
      );
    }

    if (!(await verifyPassword(user.passwordHash, dto.password))) {
      await this.recordFailedLogin(user, context);
      throw new UnauthorizedException('Email or password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.log({ action: 'LOGIN', userId: user.id, context });
    const tokens = await this.sessions.create(user, context);
    return { ...tokens, user: await this.me(user.id) };
  }

  async refresh(refreshToken: string | undefined): Promise<LoginResult> {
    const tokens = await this.sessions.rotate(refreshToken);
    return { ...tokens, user: await this.me(tokens.userId) };
  }

  async logout(refreshToken: string | undefined, context: RequestContext): Promise<void> {
    const userId = await this.sessions.revokeByToken(refreshToken);
    if (userId) await this.audit.log({ action: 'LOGOUT', userId, context });
  }

  async forgotPassword(email: string, context: RequestContext): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const token = await this.verification.issueResetToken(user.id);
      const link = `${this.config.get('FRONTEND_URL')}/reset-password?token=${encodeURIComponent(token)}`;
      await this.mail.send(mailTemplates.passwordReset(user.email, link));
      await this.audit.log({ action: 'PASSWORD_RESET_REQUESTED', userId: user.id, context });
    }
    return { message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto, context: RequestContext): Promise<{ message: string }> {
    const userId = await this.verification.consumeResetToken(dto.token);
    if (!userId) throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(dto.password), failedLoginCount: 0, lockedUntil: null },
    });
    await this.sessions.revokeAll(userId);
    await this.audit.log({ action: 'PASSWORD_RESET', userId, context });
    this.mail.sendQuietly(mailTemplates.passwordChanged(user.email));
    return { message: 'Your password has been reset. You can now sign in.' };
  }

  async changePassword(userId: string, sessionId: string, dto: ChangePasswordDto, context: RequestContext) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('Your current password is not right');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(dto.newPassword) } });
    await this.sessions.revokeAll(userId, sessionId);
    await this.audit.log({ action: 'PASSWORD_CHANGED', userId, context });
    this.mail.sendQuietly(mailTemplates.passwordChanged(user.email));
    return { message: 'Password changed. Your other devices have been signed out.' };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { firstName: true, lastName: true } } },
    });
    if (!user || user.deletedAt) throw new ForbiddenException('This account is no longer active');
    return {
      id: user.id,
      email: user.email,
      firstName: user.profile?.firstName ?? null,
      lastName: user.profile?.lastName ?? null,
    };
  }

  private async recordFailedLogin(user: User, context: RequestContext) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await this.prisma.user.update({
      where: { id: user.id },
      data: lock
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) }
        : { failedLoginCount: failures },
    });
    await this.audit.log({ action: lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', userId: user.id, context });
  }
}
