import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const CreateUserInputValidator = z.object({
  firstName: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z]+$/, { message: 'Name must contain only letters.' }),
  lastName: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z]+$/, { message: 'Name must contain only letters.' }),
  email: z.string().email(),
  password: z
    .string()
    .min(6)
    .regex(/[0-9]/, { message: 'Password must contain at least one digit.' })
    .regex(/[!@#$%^&*(),.?":{}|<>]/, {
      message: 'Password must contain at least one special character.'
    }),
  confirmPassword: z.string(),
  accountType: z.array(z.enum(['CLIENT', 'ADMIN'])).optional(),
  gender: z.enum(['Male', 'Female']).optional()
});

export class CreateUserInput extends createZodDto(CreateUserInputValidator) {}
