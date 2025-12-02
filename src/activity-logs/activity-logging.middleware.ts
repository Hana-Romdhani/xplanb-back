import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ActivityLogsService, LogActivityDto } from './activity-logs.service';
import { JwtService } from '@nestjs/jwt';

// Extend Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role?: string[];
      };
    }
  }
}

@Injectable()
export class ActivityLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
    private readonly jwtService: JwtService
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extract user from JWT token if not already set
    let userId: string | undefined;

    if (req.user) {
      userId = req.user.id;
    } else {
      // Try to extract JWT from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const payload = this.jwtService.verify(token);
          userId = payload.id || payload._id || payload.userId;
        } catch (error) {
          // Invalid token, ignore
        }
      }
    }

    // Only log authenticated requests
    if (userId) {
      const logData: LogActivityDto = {
        userId: userId,
        action: this.getActionFromRequest(req),
        resourceType: this.getResourceTypeFromRequest(req),
        resourceId: this.getResourceIdFromRequest(req),
        details: this.getDetailsFromRequest(req),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        device: this.getDeviceFromUserAgent(req.get('User-Agent')),
        location: req.get('X-Forwarded-For') || req.ip
      };

      // Log asynchronously to avoid blocking the request
      this.activityLogsService.logActivity(logData).catch((error) => {
        console.error('Failed to log activity:', error);
      });
    }

    next();
  }

  private getActionFromRequest(req: Request): string {
    const method = req.method;
    const path = req.path;

    // Map common patterns to actions
    if (path.includes('/auth/login')) return 'login';
    if (path.includes('/auth/logout')) return 'logout';
    if (path.includes('/auth/signup')) return 'signup';
    if (path.includes('/folder') && method === 'POST') return 'create_folder';
    if (path.includes('/folder') && method === 'PUT') return 'update_folder';
    if (path.includes('/folder') && method === 'DELETE') return 'delete_folder';
    if (path.includes('/document') && method === 'POST') return 'create_document';
    if (path.includes('/document') && method === 'PUT') return 'update_document';
    if (path.includes('/document') && method === 'DELETE') return 'delete_document';
    if (path.includes('/complaints') && method === 'POST') return 'submit_complaint';
    if (path.includes('/pomodoro/start')) return 'start_pomodoro';
    if (path.includes('/pomodoro/stop')) return 'stop_pomodoro';
    if (path.includes('/meetings') && method === 'POST') return 'create_meeting';

    return `${method.toLowerCase()}_${path.split('/')[1] || 'unknown'}`;
  }

  private getResourceTypeFromRequest(req: Request): string | undefined {
    const path = req.path;

    if (path.includes('/folder')) return 'folder';
    if (path.includes('/document')) return 'document';
    if (path.includes('/complaints')) return 'complaint';
    if (path.includes('/pomodoro')) return 'pomodoro_session';
    if (path.includes('/meetings')) return 'meeting';

    return undefined;
  }

  private getResourceIdFromRequest(req: Request): string | undefined {
    const path = req.path;
    const segments = path.split('/');

    // Extract ID from URL patterns like /folder/:id, /document/:id, etc.
    for (let i = 0; i < segments.length - 1; i++) {
      if (segments[i] && ['folder', 'document', 'complaints', 'meetings'].includes(segments[i])) {
        return segments[i + 1];
      }
    }

    return undefined;
  }

  private getDetailsFromRequest(req: Request): string | undefined {
    const method = req.method;

    if (method === 'POST' || method === 'PUT') {
      const body = req.body;
      if (body && typeof body === 'object') {
        // Include relevant details without sensitive data
        const details: any = {};
        if (body.title) details.title = body.title;
        if (body.Name) details.name = body.Name;
        if (body.status) details.status = body.status;
        if (body.type) details.type = body.type;

        return Object.keys(details).length > 0 ? JSON.stringify(details) : undefined;
      }
    }

    return undefined;
  }

  private getDeviceFromUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    if (userAgent.includes('Mobile')) return 'mobile';
    if (userAgent.includes('Tablet')) return 'tablet';
    if (userAgent.includes('Windows')) return 'desktop_windows';
    if (userAgent.includes('Mac')) return 'desktop_mac';
    if (userAgent.includes('Linux')) return 'desktop_linux';

    return 'unknown';
  }
}
