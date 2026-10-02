import { z } from 'zod';

export const PASSWORD_MIN = 10;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name').max(80),
  lastName: z.string().trim().min(1, 'Enter your last name').max(80),
  email: z.email('Enter a valid email address').max(254),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: z.email('Enter a valid email address') });

export const resetPasswordSchema = z.object({ token: z.string().min(20), password: passwordSchema });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: passwordSchema,
});

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface SessionView {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  code?: string;
}

/** Machine-readable codes the API puts on error responses that the web app branches on. */
export const ErrorCode = {
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  PIN_REQUIRED: 'PIN_REQUIRED',
  HEALTH_CONSENT_REQUIRED: 'HEALTH_CONSENT_REQUIRED',
  UPLOAD_LIMIT_REACHED: 'UPLOAD_LIMIT_REACHED',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
