import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, UpdateNotificationDto } from './dto/notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  async create(@Body() createNotificationDto: CreateNotificationDto, @Request() req) {
    // Only admins or system can create notifications for other users
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  async findAll(@Request() req, @Query('read') read?: string) {
    const userId = req.user.id;
    if (read === 'false') {
      return this.notificationsService.findUnread(userId);
    }
    return this.notificationsService.findAll(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const userId = req.user.id;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Get('recent')
  async getRecent(@Request() req, @Query('limit') limit?: string) {
    const userId = req.user.id;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.notificationsService.findRecent(userId, limitNumber);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    return this.notificationsService.findOne(id, userId);
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    return this.notificationsService.markAsRead(id, userId);
  }

  @Put('mark-all-read')
  async markAllAsRead(@Request() req) {
    const userId = req.user.id;
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.notificationsService.update(id, updateNotificationDto, userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    const userId = req.user.id;
    return this.notificationsService.delete(id, userId);
  }

  @Delete()
  async deleteAll(@Request() req) {
    const userId = req.user.id;
    await this.notificationsService.deleteAll(userId);
    return { message: 'All notifications deleted' };
  }
}
