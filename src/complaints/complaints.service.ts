import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Complaint, ComplaintDocument } from './complaints.schema';
import { CreateComplaintDto, UpdateComplaintStatusDto } from './dto/complaint.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(Complaint.name) private complaintModel: Model<ComplaintDocument>,
    private emailService: EmailService
  ) {}

  async create(createComplaintDto: CreateComplaintDto, userId: string): Promise<Complaint> {
    const complaint = new this.complaintModel({
      ...createComplaintDto,
      userId
    });

    const savedComplaint = await complaint.save();

    // Send email notification to admin
    await this.sendAdminNotification(savedComplaint);

    return savedComplaint;
  }

  async findAll(userId: string, isAdmin: boolean = false): Promise<Complaint[]> {
    const query = isAdmin ? {} : { userId };

    return this.complaintModel
      .find(query)
      .populate('userId', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string, userId: string, isAdmin: boolean = false): Promise<Complaint> {
    const query = isAdmin ? { _id: id } : { _id: id, userId };

    return this.complaintModel
      .findOne(query)
      .populate('userId', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName')
      .exec();
  }

  async updateStatus(
    id: string,
    updateComplaintStatusDto: UpdateComplaintStatusDto,
    adminId: string
  ): Promise<Complaint> {
    const updateData: any = {
      ...updateComplaintStatusDto,
      resolvedBy: adminId
    };

    if (updateComplaintStatusDto.status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    return this.complaintModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'firstName lastName email')
      .populate('resolvedBy', 'firstName lastName')
      .exec();
  }

  async remove(id: string, userId: string, isAdmin: boolean = false): Promise<Complaint> {
    const query = isAdmin ? { _id: id } : { _id: id, userId };

    return this.complaintModel.findOneAndDelete(query).exec();
  }

  async getStats(): Promise<any> {
    const stats = await this.complaintModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await this.complaintModel.countDocuments();

    return {
      total,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  }

  private async sendAdminNotification(complaint: Complaint): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@xplanb.com';
      const subject = `New Complaint: ${complaint.title}`;
      const message = `
        A new complaint has been submitted:
        
        Title: ${complaint.title}
        Description: ${complaint.description}
        Submitted by: ${complaint.userId}
        Status: ${complaint.status}
        
        Please review and take appropriate action.
      `;

      await this.emailService.sendEmail({
        to: adminEmail,
        subject,
        text: message,
        html: '<p>A new complaint has been submitted:\n\nTitle: ${complaint.title}\nDescription: ${complaint.description}\nSubmitted by: ${complaint.userId}\nStatus: ${complaint.status}\n\nPlease review and take appropriate action.</p>'
      });
    } catch (error) {
      console.error('Failed to send admin notification:', error);
    }
  }
}
