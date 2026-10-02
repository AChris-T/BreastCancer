import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export function contextFrom(req: Request): RequestContext {
  const userAgent = req.get('user-agent');
  return {
    ipAddress: req.ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, 500) : null,
  };
}

/** IP address and user agent of the caller, for sessions and the audit log. */
export const ReqContext = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestContext => {
  return contextFrom(ctx.switchToHttp().getRequest<Request>());
});
