import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateMessageDto, CreateConversationDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  async getConversations(@Request() req) {
    const userId = req.user.id || req.user._id;
    return this.chatService.getConversations(userId);
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string, @Request() req) {
    const userId = req.user.id || req.user._id;
    return this.chatService.getConversation(id, userId);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('limit') limit: string,
    @Query('skip') skip: string,
    @Request() req
  ) {
    const userId = req.user.id || req.user._id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const skipNum = skip ? parseInt(skip, 10) : 0;
    return this.chatService.getMessages(conversationId, userId, limitNum, skipNum);
  }

  @Post('conversations')
  async createConversation(@Body() createConversationDto: CreateConversationDto, @Request() req) {
    const userId = req.user.id || req.user._id;
    return this.chatService.createConversation(userId, createConversationDto);
  }

  @Post('messages')
  async createMessage(@Body() createMessageDto: CreateMessageDto, @Request() req) {
    const userId = req.user.id || req.user._id;
    return this.chatService.createMessage(userId, createMessageDto);
  }

  @Get('unread')
  async getUnreadCount(@Request() req) {
    const userId = req.user.id || req.user._id;
    return this.chatService.getUnreadCount(userId);
  }

  @Post('conversations/:id/read')
  async markAsRead(@Param('id') conversationId: string, @Request() req) {
    const userId = req.user.id || req.user._id;
    return this.chatService.markAsRead(conversationId, userId);
  }
}
