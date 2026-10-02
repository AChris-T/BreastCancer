import { Body, Controller, Delete, Get, Module, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuthModule } from '../auth/auth.module.js';
import { type AuthenticatedUser, CurrentUser } from '../auth/decorators.js';
import { ReqContext, type RequestContext } from '../common/request-context.js';
import { AccountService } from './account.service.js';

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string;
}

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @Get('export')
  export(@CurrentUser() user: AuthenticatedUser, @Res() res: Response, @ReqContext() ctx: RequestContext) {
    return this.account.export(user.id, res, ctx);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Delete()
  delete(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteAccountDto, @ReqContext() ctx: RequestContext) {
    return this.account.requestDeletion(user.id, dto.password, ctx);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
