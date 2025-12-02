import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Request
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Multer } from 'multer';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class FileUploadController {
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/images',
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        }
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
      }
    })
  )
  async uploadImage(@UploadedFile() file: Multer.File, @Request() req: any) {
    if (!file) {
      return {
        success: 0,
        message: 'No file uploaded'
      };
    }

    const fileUrl = `/uploads/images/${file.filename}`;

    return {
      success: 1,
      file: {
        url: fileUrl,
        name: file.originalname,
        size: file.size
      }
    };
  }

  @Post('fetch-image')
  async fetchImage(@Body() body: { url: string }, @Request() req: any) {
    const { url } = body;

    if (!url) {
      return {
        success: 0,
        message: 'No URL provided'
      };
    }

    // For now, just return the URL as-is
    // In a production environment, you might want to:
    // 1. Validate the URL
    // 2. Download and store the image locally
    // 3. Return a local URL

    return {
      success: 1,
      file: {
        url: url
      }
    };
  }
}
