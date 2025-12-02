import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Request,
  Query
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto } from './dto/calendar.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post()
  async createEvent(@Body() createCalendarEventDto: CreateCalendarEventDto, @Request() req) {
    return this.calendarService.createEvent(createCalendarEventDto, req.user.id);
  }

  @Get()
  async findAll(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.calendarService.findAll(req.user.id, start, end);
  }

  @Get('upcoming')
  async getUpcomingEvents(@Request() req, @Query('limit') limit?: string) {
    return this.calendarService.getUpcomingEvents(req.user.id, parseInt(limit) || 10);
  }

  @Get('stats')
  async getCalendarStats(@Request() req) {
    return this.calendarService.getCalendarStats(req.user.id);
  }

  @Get('resource/:resourceType/:resourceId')
  async getEventsByResource(
    @Param('resourceType') resourceType: 'document' | 'folder',
    @Param('resourceId') resourceId: string,
    @Request() req
  ) {
    return this.calendarService.getEventsByResource(resourceType, resourceId, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.calendarService.findOne(id, req.user.id);
  }

  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() updateCalendarEventDto: UpdateCalendarEventDto,
    @Request() req
  ) {
    return this.calendarService.updateEvent(id, updateCalendarEventDto, req.user.id);
  }

  @Delete(':id')
  async deleteEvent(@Param('id') id: string, @Request() req) {
    return this.calendarService.deleteEvent(id, req.user.id);
  }
}
