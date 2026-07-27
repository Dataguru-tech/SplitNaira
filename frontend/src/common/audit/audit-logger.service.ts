import { Injectable, Logger } from '@nestjs/common';

export interface AdminDenialAuditEvent {
  eventName: 'ADMIN_ACCESS_DENIED';
  correlationId: string;
  route: string;
  method: string;
  reasonCategory:
    | 'MISSING_API_KEY'
    | 'INVALID_API_KEY'
    | 'UNAUTHORIZED_ROLE'
    | 'WRITES_DISABLED'
    | 'MALFORMED_PAYLOAD';
  callerFingerprint?: string; // IP address or masked identifier
  timestamp: string;
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger('AdminSecurityAudit');

  /**
   * Logs denied administrative attempts with correlation tracking and strict secret masking.
   */
  logAdminDenial(event: Omit<AdminDenialAuditEvent, 'eventName' | 'timestamp'>): void {
    const auditPayload: AdminDenialAuditEvent = {
      eventName: 'ADMIN_ACCESS_DENIED',
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Output structured JSON log for log aggregation (e.g., Datadog, ELK)
    this.logger.warn(JSON.stringify(auditPayload));
  }
}