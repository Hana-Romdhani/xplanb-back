import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

const UpdateDocumentsvalidationlayer = z.object({
  Title: z
    .string({
      invalid_type_error: 'Title must be a string'
    })
    .min(1, { message: 'Title cannot be empty' })
    .max(50, { message: 'Title cannot exceed 50 characters' })
    .optional(),

  createdDate: z.string().datetime().min(new Date('2024-01-01T12:00:00').getTime()).optional(),

  updatedDate: z
    .string()
    .datetime()
    .refine(
      function (value) {
        return this.createdDate !== undefined ? value >= this.createdDate : true;
      },
      { message: 'Update date must be later than creation date' }
    )
    .optional(),

  contentType: z.union([z.string(), z.array(z.string())]).optional(),
  folderId: z
    .string({
      invalid_type_error: 'Folder ID must be a string'
    })
    .min(1, { message: 'Folder ID cannot be empty' })
    .optional(),
  folderName: z.string().optional()
});

export class updateDocumentsDTOlayer extends createZodDto(UpdateDocumentsvalidationlayer) {}
