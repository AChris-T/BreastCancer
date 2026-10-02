import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators.js';
import { StorageService } from './storage.service.js';

/** Serves local-driver files behind signed, expiring tokens. Unused with the S3 driver. */
@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @SkipThrottle()
  @Get(':token')
  async get(@Param('token') token: string, @Res() res: Response) {
    const verified = this.storage.isLocal ? this.storage.verifyLocalToken(token) : null;
    if (!verified) throw new NotFoundException('This link has expired');
    const body = await this.storage.get(verified.key).catch(() => null);
    if (!body) throw new NotFoundException('File not found');
    res.set({
      'Content-Type': verified.contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(body);
  }
}
