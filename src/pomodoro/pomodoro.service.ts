import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PomodoroSession, PomodoroSessionDocument } from './pomodoro.schema';
import { StartPomodoroSessionDto, StopPomodoroSessionDto } from './dto/pomodoro.dto';

@Injectable()
export class PomodoroService {
  constructor(
    @InjectModel(PomodoroSession.name)
    private pomodoroSessionModel: Model<PomodoroSessionDocument>
  ) {}

  async startSession(
    startPomodoroSessionDto: StartPomodoroSessionDto,
    userId: string
  ): Promise<PomodoroSession> {
    // Stop any active session first
    await this.stopActiveSession(userId);

    const session = new this.pomodoroSessionModel({
      ...startPomodoroSessionDto,
      userId: new Types.ObjectId(userId),
      startTime: new Date(),
      completed: false,
      interrupted: false
    });

    return session.save();
  }

  async stopSession(
    sessionId: string,
    stopPomodoroSessionDto: StopPomodoroSessionDto,
    userId: string
  ): Promise<PomodoroSession> {
    const session = await this.pomodoroSessionModel.findOne({
      _id: sessionId,
      userId: new Types.ObjectId(userId),
      endTime: { $exists: false }
    });

    if (!session) {
      throw new NotFoundException('Session not found or already completed');
    }

    session.endTime = new Date();
    session.completed = !stopPomodoroSessionDto.interrupted;
    session.interrupted = stopPomodoroSessionDto.interrupted || false;
    session.interruptionReason = stopPomodoroSessionDto.interruptionReason;

    return session.save();
  }

  async stopActiveSession(userId: string): Promise<void> {
    await this.pomodoroSessionModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        endTime: { $exists: false }
      },
      {
        endTime: new Date(),
        completed: false,
        interrupted: true,
        interruptionReason: 'New session started'
      }
    );
  }

  async getActiveSession(userId: string): Promise<PomodoroSession | null> {
    return this.pomodoroSessionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        endTime: { $exists: false }
      })
      .exec();
  }

  async getStats(userId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const sessions = await this.pomodoroSessionModel
      .find({
        userId: new Types.ObjectId(userId),
        startTime: { $gte: startDate },
        endTime: { $exists: true }
      })
      .exec();

    const stats = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter((s) => s.completed).length,
      interruptedSessions: sessions.filter((s) => s.interrupted).length,
      totalWorkTime: sessions
        .filter((s) => s.type === 'work' && s.completed)
        .reduce((total, s) => total + s.duration, 0),
      totalBreakTime: sessions
        .filter((s) => s.type === 'break' && s.completed)
        .reduce((total, s) => total + s.duration, 0),
      averageSessionLength:
        sessions.length > 0
          ? sessions.reduce((total, s) => total + s.duration, 0) / sessions.length
          : 0,
      productivityScore: this.calculateProductivityScore(sessions)
    };

    return stats;
  }

  async getRecentSessions(userId: string, limit: number = 10): Promise<PomodoroSession[]> {
    return this.pomodoroSessionModel
      .find({ userId: new Types.ObjectId(userId), endTime: { $exists: true } })
      .sort({ startTime: -1 })
      .limit(limit)
      .exec();
  }

  async getDailySessions(userId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const query: any = {
      userId: new Types.ObjectId(userId),
      endTime: { $exists: true },
      type: 'work',
      completed: true
    };

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) {
        query.startTime.$gte = startDate;
      }
      if (endDate) {
        query.startTime.$lte = endDate;
      }
    }

    const sessions = await this.pomodoroSessionModel.find(query).sort({ startTime: -1 }).exec();

    // Group sessions by date
    const dailySessions: { [date: string]: PomodoroSession[] } = {};

    sessions.forEach((session) => {
      const dateKey = new Date(session.startTime).toISOString().split('T')[0];
      if (!dailySessions[dateKey]) {
        dailySessions[dateKey] = [];
      }
      dailySessions[dateKey].push(session);
    });

    // Calculate stats per day
    const dailyStats = Object.entries(dailySessions).map(([date, daySessions]) => {
      const totalMinutes = daySessions.reduce((sum, s) => sum + s.duration, 0);
      const avgSessionLength = daySessions.length > 0 ? totalMinutes / daySessions.length : 0;

      return {
        date,
        sessionCount: daySessions.length,
        totalMinutes,
        averageMinutes: Math.round(avgSessionLength * 10) / 10,
        sessions: daySessions.map((s) => ({
          id: s._id.toString(),
          duration: s.duration,
          startTime: s.startTime,
          endTime: s.endTime
        }))
      };
    });

    // Sort by date (newest first)
    dailyStats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      dailyStats,
      totalDays: dailyStats.length,
      totalSessions: sessions.length,
      totalMinutes: sessions.reduce((sum, s) => sum + s.duration, 0),
      averageMinutesPerDay:
        dailyStats.length > 0
          ? Math.round(
              (dailyStats.reduce((sum, d) => sum + d.totalMinutes, 0) / dailyStats.length) * 10
            ) / 10
          : 0
    };
  }

  private calculateProductivityScore(sessions: PomodoroSession[]): number {
    if (sessions.length === 0) return 0;

    const completedWorkSessions = sessions.filter((s) => s.type === 'work' && s.completed).length;
    const totalWorkSessions = sessions.filter((s) => s.type === 'work').length;
    const completionRate = totalWorkSessions > 0 ? completedWorkSessions / totalWorkSessions : 0;

    const avgWorkDuration =
      sessions
        .filter((s) => s.type === 'work' && s.completed)
        .reduce((total, s) => total + s.duration, 0) / completedWorkSessions || 0;

    const durationScore = Math.min(avgWorkDuration / 25, 1); // 25 minutes is ideal

    return Math.round((completionRate * 0.7 + durationScore * 0.3) * 100);
  }
}
