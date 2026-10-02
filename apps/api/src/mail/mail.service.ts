import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfig } from '../config/config.module.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends transactional email through Resend. Without RESEND_API_KEY (only
 * allowed outside production) messages are written to the log instead, so
 * OTP codes can be read during local development.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: AppConfig) {
    const key = config.get('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
    this.from = config.get('MAIL_FROM');
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`[mail:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: toHtml(message.text),
    });
    if (error) {
      this.logger.error({ err: error, subject: message.subject }, 'Email send failed');
      throw new Error(`Email send failed: ${error.message}`);
    }
  }

  /** Fire-and-forget variant for notifications that must not fail the caller. */
  sendQuietly(message: MailMessage): void {
    this.send(message).catch(() => undefined);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function toHtml(text: string) {
  const body = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1B2733;max-width:560px">
<p style="margin:0 0 24px;font-weight:700;color:#0A2E52;font-size:18px">BreastScan AI</p>${body}
<p style="margin:24px 0 0;font-size:13px;color:#5B6B7C">BreastScan AI is a screening aid, not a diagnosis. Always discuss results with a qualified clinician.</p></div>`;
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
