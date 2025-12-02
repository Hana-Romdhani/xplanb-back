import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Request
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { Comment } from './comments.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async create(@Body() comment: Comment, @Request() req: any): Promise<Comment> {
    // Add user from request to comment if not provided
    if (!comment.user) {
      comment.user = req.user.id;
    }
    return this.commentsService.create(comment);
  }

  @Get('/document/:documentId')
  async findAll(@Param('documentId') documentId: string): Promise<Comment[]> {
    return this.commentsService.findAll(documentId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() comment: Comment): Promise<Comment> {
    return this.commentsService.update(id, comment);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.commentsService.remove(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Comment> {
    return this.commentsService.findOne(id);
  }
}
