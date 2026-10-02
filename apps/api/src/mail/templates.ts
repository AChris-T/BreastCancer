import type { MailMessage } from './mail.service.js';

export const mailTemplates = {
  passwordReset: (to: string, link: string): MailMessage => ({
    to,
    subject: 'Reset your BreastScan AI password',
    text: `Use this link to choose a new password. It expires in 30 minutes and can be used once.\n\n${link}\n\nIf you did not ask to reset your password, you can ignore this email; your password has not changed.`,
  }),

  passwordChanged: (to: string): MailMessage => ({
    to,
    subject: 'Your BreastScan AI password was changed',
    text: 'Your password was just changed and you have been signed out of your other devices.\n\nIf this was not you, reset your password now and contact us.',
  }),

  analysisReady: (to: string, link: string): MailMessage => ({
    to,
    subject: 'Your case classification is ready',
    text: `The analysis of your upload is complete. For privacy, the result is only shown after you sign in.\n\n${link}`,
  }),

  analysisFailed: (to: string, link: string): MailMessage => ({
    to,
    subject: 'We could not analyse your upload',
    text: `We were not able to analyse your recent upload. You can try again from the scan page.\n\n${link}`,
  }),

  accountDeletion: (to: string, days: number): MailMessage => ({
    to,
    subject: 'Your BreastScan AI account will be deleted',
    text: `We received your request to delete your account. You have been signed out, and your account and all your scans will be permanently deleted in ${days} days.\n\nIf you did not ask for this, contact us straight away.`,
  }),
};
