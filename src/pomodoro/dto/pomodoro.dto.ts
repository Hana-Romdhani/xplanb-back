import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const StartPomodoroSessionValidator = z.object({
  type: z.enum(['work', 'break', 'long_break']),
  duration: z.number().min(1).max(60)
});

export class StartPomodoroSessionDto extends createZodDto(StartPomodoroSessionValidator) {}

export const StopPomodoroSessionValidator = z.object({
  interrupted: z.boolean().optional(),
  interruptionReason: z.string().optional()
});

export class StopPomodoroSessionDto extends createZodDto(StopPomodoroSessionValidator) {}
