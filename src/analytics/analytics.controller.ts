import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { BusinessAnalyticsService } from './business-analytics.service';
import { AnalyticsMetricsDto } from './dto/analytics-metrics.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly businessAnalyticsService: BusinessAnalyticsService
  ) {}

  @Get('productivity')
  async getUserProductivity(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string
  ) {
    const targetUserId = userId || req.user.id;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getUserProductivityMetrics(targetUserId, start, end);
  }

  @Get('team')
  async getTeamCollaboration(
    @Query('organizationId') organizationId?: string,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getTeamCollaborationMetrics(organizationId, start, end);
  }

  @Get('projectOverview')
  async getProjectOverview(@Request() req: any, @Query('folderId') folderId?: string) {
    const userId = req.user?.id || req.user?._id;
    return this.analyticsService.getProjectOverview(folderId, userId);
  }

  @Get('folders')
  async getFolderAnalytics(@Request() req: any) {
    const userId = req.user?.id || req.user?._id;
    return this.analyticsService.getFolderAnalytics(userId);
  }

  @Get('versions')
  async getVersionAnalytics(
    @Request() req: any,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string
  ) {
    const userId = req.user?.id || req.user?._id;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getVersionAnalytics(start, end, userId);
  }

  // Business Analytics Endpoints
  @Get('productivity-scores')
  async getProductivityScores() {
    return this.businessAnalyticsService.getProductivityScores();
  }

  @Get('collaboration-health')
  async getCollaborationHealth() {
    return this.businessAnalyticsService.getCollaborationHealth();
  }

  @Get('smart-recommendations')
  async getSmartRecommendations() {
    return this.businessAnalyticsService.getSmartRecommendations();
  }

  @Get('roi-metrics')
  async getROIMetrics() {
    return this.businessAnalyticsService.getROIMetrics();
  }

  @Get('document-lifecycle')
  async getDocumentLifecycle() {
    return this.businessAnalyticsService.getDocumentLifecycle();
  }

  @Get('team-performance')
  async getTeamPerformanceInsights() {
    return this.businessAnalyticsService.getTeamPerformanceInsights();
  }
}
