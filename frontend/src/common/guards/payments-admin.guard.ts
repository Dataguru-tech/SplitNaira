import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuditLoggerService } from '../audit/audit-logger.service';

@Injectable()
export class PaymentsAdminGuard implements CanActivate {
  constructor(private readonly auditLogger: AuditLoggerService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const correlationId = (request.headers['x-correlation-id'] as string) || 'N/A';
    const route = request.route?.path || request.url;
    const method = request.method;
    const callerFingerprint = request.ip || request.headers['x-forwarded-for'] || 'unknown';

    const apiKey = request.headers['x-admin-api-key'];

    // 1. Missing API Key
    if (!apiKey) {
      this.auditLogger.logAdminDenial({
        correlationId,
        route,
        method,
        reasonCategory: 'MISSING_API_KEY',
        callerFingerprint,
      });
      throw new UnauthorizedException('Admin API key is missing');
    }

    // 2. Writes Disabled Check
    if (process.env.ADMIN_WRITES_ENABLED === 'false' && method !== 'GET') {
      this.auditLogger.logAdminDenial({
        correlationId,
        route,
        method,
        reasonCategory: 'WRITES_DISABLED',
        callerFingerprint,
      });
      throw new ForbiddenException('Admin write operations are currently disabled');
    }

    // 3. Unauthorized Role
    if (request.user && !request.user.roles?.includes('PAYMENTS_ADMIN')) {
      this.auditLogger.logAdminDenial({
        correlationId,
        route,
        method,
        reasonCategory: 'UNAUTHORIZED_ROLE',
        callerFingerprint,
      });
      throw new ForbiddenException('User lacks required PAYMENTS_ADMIN role');
    }

    // 4. Malformed Payload Check
    if (['POST', 'PUT', 'PATCH'].includes(method) && (!request.body || Object.keys(request.body).length === 0)) {
      this.auditLogger.logAdminDenial({
        correlationId,
        route,
        method,
        reasonCategory: 'MALFORMED_PAYLOAD',
        callerFingerprint,
      });
      throw new BadRequestException('Request body is malformed or empty');
    }

    return true;
  }
}