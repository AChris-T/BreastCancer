import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@breastscan/shared';

/** An HTTP error carrying a machine-readable `code` the web app can branch on. */
export class CodedException extends HttpException {
  constructor(status: HttpStatus, message: string, code: ErrorCode) {
    super({ statusCode: status, message, code }, status);
  }
}
