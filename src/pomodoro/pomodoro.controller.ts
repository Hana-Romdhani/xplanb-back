import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PomodoroService } from './pomodoro.service';
import { StartPomodoroSessionDto, StopPomodoroSessionDto } from './dto/pomodoro.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('pomodoro')
@UseGuards(JwtAuthGuard)
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Post('start')
  async startSession(@Body() startPomodoroSessionDto: StartPomodoroSessionDto, @Request() req) {
    return this.pomodoroService.startSession(startPomodoroSessionDto, req.user.id);
  }

  @Post('stop/:id')
  async stopSession(
    @Param('id') id: string,
    @Body() stopPomodoroSessionDto: StopPomodoroSessionDto,
    @Request() req
  ) {
    return this.pomodoroService.stopSession(id, stopPomodoroSessionDto, req.user.id);
  }

  @Get('active')
  async getActiveSession(@Request() req) {
    return this.pomodoroService.getActiveSession(req.user.id);
  }

  @Get('stats')
  async getStats(@Request() req, @Query('period') period?: 'daily' | 'weekly' | 'monthly') {
    return this.pomodoroService.getStats(req.user.id, period);
  }

  @Get('recent')
  async getRecentSessions(@Request() req) {
    return this.pomodoroService.getRecentSessions(req.user.id);
  }

  @Get('daily')
  async getDailySessions(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.pomodoroService.getDailySessions(req.user.id, start, end);
  }
}
