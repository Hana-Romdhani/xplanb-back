import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

const ResetPasswordSchema = z.object({
  password: z
    .string()
    .min(6)
    .regex(
      passwordRegex,
      'Password must contain at least 1 lowercase letter, 1 uppercase letter, 1 digit, and 1 special character'
    ),
  confirmNewPassword: z
    .string()
    .min(6)
    .regex(
      passwordRegex,
      'Password must contain at least 1 lowercase letter, 1 uppercase letter, 1 digit, and 1 special character'
    ),
  token: z.string()
});

export class ResetPasswordInput extends createZodDto(ResetPasswordSchema) {}
