import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MeetingsService, CreateMeetingDto, UpdateMeetingDto } from './meetings.service';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post('start')
  async startMeeting(@Body() createMeetingDto: CreateMeetingDto, @Request() req: any) {
    const createdBy = req.user.id;
    return this.meetingsService.createMeeting(createMeetingDto, createdBy);
  }

  @Post('join')
  async joinMeeting(@Body('meetingRoomId') meetingRoomId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.meetingsService.joinMeetingByRoomId(meetingRoomId, userId);
  }

  @Post('end/:id')
  @HttpCode(HttpStatus.OK)
  async endMeeting(@Param('id') meetingId: string, @Body() updateData: UpdateMeetingDto) {
    return this.meetingsService.endMeeting(meetingId, updateData);
  }

  @Get('byDoc/:docId')
  async getMeetingsByDocument(@Param('docId') docId: string) {
    return this.meetingsService.getMeetingsByDocument(docId);
  }

  @Get('byFolder/:folderId')
  async getMeetingsByFolder(@Param('folderId') folderId: string) {
    return this.meetingsService.getMeetingsByFolder(folderId);
  }

  @Patch(':id/transcript')
  async updateMeetingTranscript(
    @Param('id') meetingId: string,
    @Body() body: { transcript: string }
  ) {
    return this.meetingsService.updateMeetingTranscript(meetingId, body.transcript);
  }

  @Get(':id')
  async getMeetingById(@Param('id') meetingId: string) {
    return this.meetingsService.getMeetingById(meetingId);
  }

  @Get('user/:userId')
  async getUserMeetings(@Param('userId') userId: string, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.meetingsService.getUserMeetings(userId, limitNum);
  }

  @Get('upcoming/:userId')
  async getUpcomingMeetings(@Param('userId') userId: string) {
    return this.meetingsService.getUpcomingMeetings(userId);
  }

  @Get('room/:meetingRoomId')
  async getMeetingByRoom(@Param('meetingRoomId') meetingRoomId: string) {
    return this.meetingsService.getMeetingByRoomId(meetingRoomId);
  }
}
