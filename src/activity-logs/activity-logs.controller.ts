import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  async getUserActivityLogs(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const isAdmin = req.user.role?.includes('ADMIN');

    if (isAdmin) {
      return this.activityLogsService.getAllActivityLogs(
        parseInt(limit) || 100,
        parseInt(offset) || 0
      );
    }

    return this.activityLogsService.getUserActivityLogs(
      req.user.id,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );
  }

  @Get('stats')
  async getActivityStats(@Request() req) {
    const isAdmin = req.user.role?.includes('ADMIN');
    const userId = isAdmin ? undefined : req.user.id;

    return this.activityLogsService.getActivityStats(userId);
  }

  @Get('recent')
  async getRecentActivity(@Request() req, @Query('hours') hours?: string) {
    const isAdmin = req.user.role?.includes('ADMIN');
    const userId = isAdmin ? undefined : req.user.id;

    return this.activityLogsService.getRecentActivity(userId, parseInt(hours) || 24);
  }
}
