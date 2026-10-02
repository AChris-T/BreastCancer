import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthResponse } from '@breastscan/shared';
import { AuditService } from '../audit/audit.service.js';
import { ReqContext, type RequestContext } from '../common/request-context.js';
import { AppConfig } from '../config/config.module.js';
import { AuthService, type LoginResult } from './auth.service.js';
import { type AuthenticatedUser, CurrentUser, Public } from './decorators.js';
import { ChangePasswordDto, EmailDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto.js';
import { REFRESH_TTL_MS, SessionsService } from './sessions.service.js';

export const REFRESH_COOKIE = 'bs_refresh';
const COOKIE_PATH = '/api/v1/auth';

// Per IP. Kept above 5 because many mobile users share one IP behind carrier NAT;
// the per-account lockout in AuthService is the real brute-force guard.
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  async register(@Body() dto: RegisterDto, @ReqContext() ctx: RequestContext, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.register(dto, ctx));
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @ReqContext() ctx: RequestContext, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.login(dto, ctx));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.respond(res, await this.auth.refresh(readCookie(req)));
    } catch (error) {
      this.clearCookie(res);
      throw error;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @ReqContext() ctx: RequestContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readCookie(req), ctx);
    this.clearCookie(res);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: EmailDto, @ReqContext() ctx: RequestContext) {
    return this.auth.forgotPassword(dto.email, ctx);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @ReqContext() ctx: RequestContext) {
    return this.auth.resetPassword(dto, ctx);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto, @ReqContext() ctx: RequestContext) {
    return this.auth.changePassword(user.id, user.sessionId, dto, ctx);
  }

  @ApiBearerAuth()
  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.list(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @HttpCode(204)
  @Delete('sessions/:id')
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ReqContext() ctx: RequestContext,
  ) {
    if (!(await this.sessions.revoke(user.id, id))) throw new NotFoundException('Session not found');
    await this.audit.log({ action: 'SESSION_REVOKED', userId: user.id, entityType: 'Session', entityId: id, context: ctx });
  }

  private respond(res: Response, result: LoginResult): AuthResponse {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: REFRESH_TTL_MS,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: this.config.isProduction, sameSite: 'strict', path: COOKIE_PATH });
  }
}

function readCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}
