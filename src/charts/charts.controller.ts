import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChartsService } from './charts.service';
import { ChartComment } from './chart-comment.schema';
import { ChartVersion } from './chart-version.schema';
import { ChartMetadata } from './chart-metadata.schema';

@Controller('charts')
@UseGuards(JwtAuthGuard)
export class ChartsController {
  constructor(private readonly chartsService: ChartsService) {}

  // Chart Comments
  @Post(':chartId/comments')
  async createComment(
    @Param('chartId') chartId: string,
    @Body() commentData: Partial<ChartComment>,
    @Request() req: any
  ): Promise<ChartComment> {
    return this.chartsService.createComment({
      ...commentData,
      chartId,
      user: req.user.id
    });
  }

  @Get(':chartId/comments')
  async getComments(@Param('chartId') chartId: string): Promise<ChartComment[]> {
    return this.chartsService.getCommentsByChartId(chartId);
  }

  @Put('comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body('content') content: string
  ): Promise<ChartComment> {
    return this.chartsService.updateComment(commentId, content);
  }

  @Delete('comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string): Promise<ChartComment> {
    return this.chartsService.deleteComment(commentId);
  }

  // Chart Versions
  @Post(':chartId/versions')
  async createVersion(
    @Param('chartId') chartId: string,
    @Body() versionData: Partial<ChartVersion>,
    @Request() req: any
  ): Promise<ChartVersion> {
    return this.chartsService.createVersion({
      ...versionData,
      chartId,
      createdBy: req.user.id
    });
  }

  @Get(':chartId/versions')
  async getVersions(@Param('chartId') chartId: string): Promise<ChartVersion[]> {
    return this.chartsService.getVersionsByChartId(chartId);
  }

  @Post('versions/:versionId/restore')
  async restoreVersion(@Param('versionId') versionId: string): Promise<ChartVersion> {
    return this.chartsService.restoreVersion(versionId);
  }

  @Get(':chartId/versions/active')
  async getActiveVersion(@Param('chartId') chartId: string): Promise<ChartVersion> {
    return this.chartsService.getActiveVersion(chartId);
  }

  // Chart Metadata
  @Post()
  async createChart(
    @Body() metadata: Partial<ChartMetadata>,
    @Request() req: any
  ): Promise<ChartMetadata> {
    return this.chartsService.createChartMetadata({
      ...metadata,
      createdBy: req.user.id
    });
  }

  @Get(':chartId/metadata')
  async getChartMetadata(@Param('chartId') chartId: string): Promise<ChartMetadata> {
    return this.chartsService.getChartMetadata(chartId);
  }

  @Put(':chartId/metadata')
  async updateChartMetadata(
    @Param('chartId') chartId: string,
    @Body() metadata: Partial<ChartMetadata>
  ): Promise<ChartMetadata> {
    return this.chartsService.updateChartMetadata(chartId, metadata);
  }

  @Get('user/:userId')
  async getUserCharts(@Param('userId') userId: string): Promise<ChartMetadata[]> {
    return this.chartsService.getUserCharts(userId);
  }

  @Post(':chartId/share')
  async shareChart(
    @Param('chartId') chartId: string,
    @Body() shareOptions: { isPublic: boolean; shareWithUsers?: string[] }
  ): Promise<ChartMetadata> {
    return this.chartsService.shareChart(chartId, shareOptions);
  }

  // Chart Analytics
  @Get(':chartId/analytics/interactions')
  async getChartAnalytics(
    @Param('chartId') chartId: string,
    @Query('start') startDate?: string,
    @Query('end') endDate?: string
  ): Promise<any> {
    const dateRange =
      startDate && endDate
        ? {
            start: new Date(startDate),
            end: new Date(endDate)
          }
        : undefined;

    return this.chartsService.getChartAnalytics(chartId, dateRange);
  }

  @Post(':chartId/analytics/interactions')
  async trackChartInteraction(
    @Param('chartId') chartId: string,
    @Body() interaction: { type: string; data?: any },
    @Request() req: any
  ): Promise<void> {
    return this.chartsService.trackChartInteraction(chartId, {
      ...interaction,
      userId: req.user.id
    });
  }

  // Export functionality
  @Get(':chartId/export')
  async exportChart(
    @Param('chartId') chartId: string,
    @Query('format') format: 'png' | 'pdf' | 'json'
  ): Promise<any> {
    return this.chartsService.exportChart(chartId, format);
  }
}
