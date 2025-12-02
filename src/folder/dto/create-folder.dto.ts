import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';

const foldervalidationlayer = z.object({
  Name: z.string({
    required_error: 'Name is required',
    invalid_type_error: 'Name must be a string'
  }),
  parentFolderId: z.string().optional(),
  documents: z.array(z.any()).optional(),
  contents: z.array(z.any()).optional(),
  sharedWith: z.array(z.any()).optional(),
  access: z.string().optional()
});

export class createFolderDTOlayer extends createZodDto(foldervalidationlayer) {}
