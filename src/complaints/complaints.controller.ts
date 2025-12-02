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
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  async create(@Body() createComplaintDto: CreateComplaintDto, @Request() req) {
    return this.complaintsService.create(createComplaintDto, req.user.id);
  }

  @Get()
  async findAll(@Request() req) {
    const isAdmin = req.user.role?.includes('ADMIN');
    return this.complaintsService.findAll(req.user.id, isAdmin);
  }

  @Get('stats')
  async getStats(@Request() req) {
    const isAdmin = req.user.role?.includes('ADMIN');
    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }
    return this.complaintsService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const isAdmin = req.user.role?.includes('ADMIN');
    return this.complaintsService.findOne(id, req.user.id, isAdmin);
  }

  @Put(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateComplaintStatusDto: UpdateComplaintStatusDto,
    @Request() req
  ) {
    const isAdmin = req.user.role?.includes('ADMIN');
    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }
    return this.complaintsService.updateStatus(id, updateComplaintStatusDto, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const isAdmin = req.user.role?.includes('ADMIN');
    return this.complaintsService.remove(id, req.user.id, isAdmin);
  }
}
