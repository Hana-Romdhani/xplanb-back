import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const CreateCalendarEventValidator = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  participants: z.array(z.string()),
  linkedDocId: z.string().optional(),
  linkedFolderId: z.string().optional(),
  location: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['daily', 'weekly', 'monthly']).optional(),
  recurrenceEndDate: z.string().datetime().optional()
});

export class CreateCalendarEventDto extends createZodDto(CreateCalendarEventValidator) {}

export const UpdateCalendarEventValidator = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  participants: z.array(z.string()).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  location: z.string().optional(),
  recordingUrl: z.string().url().optional()
});

export class UpdateCalendarEventDto extends createZodDto(UpdateCalendarEventValidator) {}
