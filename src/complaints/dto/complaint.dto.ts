import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const CreateComplaintValidator = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  screenshot: z.string().url().optional()
});

export class CreateComplaintDto extends createZodDto(CreateComplaintValidator) {}

export const UpdateComplaintStatusValidator = z.object({
  status: z.enum(['open', 'in_review', 'resolved']),
  adminResponse: z.string().optional()
});

export class UpdateComplaintStatusDto extends createZodDto(UpdateComplaintStatusValidator) {}
