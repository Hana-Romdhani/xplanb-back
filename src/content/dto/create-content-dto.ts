import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

const Contentvalidation = z.object({
  documentId: z.string().min(1, 'documentId is required'),
  content: z.string(), // Allow empty string
  creationDate: z.date().optional() // Make optional, will be set by backend if not provided
});

export class createContentDTO extends createZodDto(Contentvalidation) {}
