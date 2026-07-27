import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsAdminGuard } from '../payments-admin.guard';
import { AuditLoggerService } from '../../audit/audit-logger.service';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ExecutionContext,
} from '@nestjs/common';

describe('PaymentsAdminGuard Audit Logging (#826)', () => {
  let guard: PaymentsAdminGuard;
  let auditLogger: jest.Mocked<AuditLoggerService>;

  beforeEach(async () => {
    const mockAuditLogger = {
      logAdminDenial: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsAdminGuard,
        { provide: AuditLoggerService, useValue: mockAuditLogger },
      ],
    }).compile();

    guard = module.get<PaymentsAdminGuard>(PaymentsAdminGuard);
    auditLogger = module.get(AuditLoggerService);
  });

  const createMockContext = (headers = {}, user?: any, body?: any, method = 'POST'): ExecutionContext => {
    const req = {
      headers: { 'x-correlation-id': 'corr-123-abc', ...headers },
      route: { path: '/v1/admin/payouts' },
      url: '/v1/admin/payouts',
      method,
      ip: '192.168.1.1',
      user,
      body,
    };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as ExecutionContext;
  };

  it('logs audit denial when API key is missing and avoids leaking secrets', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(auditLogger.logAdminDenial).toHaveBeenCalledWith({
      correlationId: 'corr-123-abc',
      route: '/v1/admin/payouts',
      method: 'POST',
      reasonCategory: 'MISSING_API_KEY',
      callerFingerprint: '192.168.1.1',
    });
  });

  it('logs audit denial when admin writes are disabled', () => {
    process.env.ADMIN_WRITES_ENABLED = 'false';
    const context = createMockContext({ 'x-admin-api-key': 'valid-key' }, undefined, { amount: 100 });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(auditLogger.logAdminDenial).toHaveBeenCalledWith({
      correlationId: 'corr-123-abc',
      route: '/v1/admin/payouts',
      method: 'POST',
      reasonCategory: 'WRITES_DISABLED',
      callerFingerprint: '192.168.1.1',
    });
    delete process.env.ADMIN_WRITES_ENABLED;
  });

  it('logs audit denial when user lacks PAYMENTS_ADMIN role', () => {
    const context = createMockContext(
      { 'x-admin-api-key': 'valid-key' },
      { roles: ['STANDARD_USER'] },
      { amount: 100 },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(auditLogger.logAdminDenial).toHaveBeenCalledWith({
      correlationId: 'corr-123-abc',
      route: '/v1/admin/payouts',
      method: 'POST',
      reasonCategory: 'UNAUTHORIZED_ROLE',
      callerFingerprint: '192.168.1.1',
    });
  });

  it('logs audit denial on malformed payload without logging raw body contents', () => {
    const context = createMockContext({ 'x-admin-api-key': 'valid-key' }, { roles: ['PAYMENTS_ADMIN'] }, {});

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    expect(auditLogger.logAdminDenial).toHaveBeenCalledWith({
      correlationId: 'corr-123-abc',
      route: '/v1/admin/payouts',
      method: 'POST',
      reasonCategory: 'MALFORMED_PAYLOAD',
      callerFingerprint: '192.168.1.1',
    });

    // Verify raw body contents were NOT passed to the audit logger
    const lastCallArg = auditLogger.logAdminDenial.mock.calls[0][0];
    expect(lastCallArg).not.toHaveProperty('body');
  });
});