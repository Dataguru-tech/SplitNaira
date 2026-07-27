import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: DataSource;
  let redis: Redis;

  beforeEach(async () => {
    // ASSUMPTION: HealthService takes DataSource and Redis as constructor
    // deps via Nest's DI. Adjust the provider tokens/mocks below to match
    // however your module actually wires this up (e.g. a custom
    // 'REDIS_CLIENT' token instead of the Redis class itself).
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: { query: jest.fn() },
        },
        {
          provide: Redis,
          useValue: { ping: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    dataSource = module.get<DataSource>(DataSource);
    redis = module.get<Redis>(Redis);
  });

  afterEach(() => {
    // Belt-and-suspenders: restores any spies AND resets mock
    // implementations/return values between tests so state from one test
    // (e.g. a rejected mock) can't leak into the next.
    jest.restoreAllMocks();
  });

  describe('getLiveness', () => {
    it('returns liveness status', () => {
      expect(service.getLiveness()).toHaveProperty('status', 'alive');
    });

    it('does not touch downstream dependencies', () => {
      // Liveness should mean "the process is up", not "dependencies are
      // reachable" — that's what readiness is for. This guards against
      // someone accidentally wiring a DB/Redis call into getLiveness later.
      const querySpy = jest.spyOn(dataSource, 'query');
      const pingSpy = jest.spyOn(redis, 'ping');

      service.getLiveness();

      expect(querySpy).not.toHaveBeenCalled();
      expect(pingSpy).not.toHaveBeenCalled();
    });
  });

  describe('getReadiness', () => {
    it('returns ready when database and redis are both healthy', async () => {
      jest.spyOn(dataSource, 'query').mockResolvedValue([]);
      jest.spyOn(redis, 'ping').mockResolvedValue('PONG');

      const result = await service.getReadiness();

      expect(result.status).toBe('ready');
    });

    it('returns not-ready when the database check fails', async () => {
      jest
        .spyOn(dataSource, 'query')
        .mockRejectedValue(new Error('connection refused'));
      jest.spyOn(redis, 'ping').mockResolvedValue('PONG');

      const result = await service.getReadiness();

      expect(result.status).toBe('not ready');
      // ASSUMPTION: getReadiness() returns per-dependency detail under
      // result.details. Replace this with whatever shape your service
      // actually returns (or delete it if there's no per-dependency detail).
      expect(result.details?.database?.status).toBe('down');
    });

    it('returns not-ready when redis fails to respond', async () => {
      jest.spyOn(dataSource, 'query').mockResolvedValue([]);
      jest.spyOn(redis, 'ping').mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.getReadiness();

      expect(result.status).toBe('not ready');
      expect(result.details?.redis?.status).toBe('down');
    });

    it('reports both failures when every dependency is down', async () => {
      jest.spyOn(dataSource, 'query').mockRejectedValue(new Error('db down'));
      jest.spyOn(redis, 'ping').mockRejectedValue(new Error('redis down'));

      const result = await service.getReadiness();

      expect(result.status).toBe('not ready');
      expect(result.details?.database?.status).toBe('down');
      expect(result.details?.redis?.status).toBe('down');
    });

    it('treats an unexpected ping response as unhealthy, not just a thrown error', async () => {
      // Redis returning something other than 'PONG' without throwing is an
      // easy failure mode to miss if the check only wraps the call in
      // try/catch and never inspects the resolved value.
      jest.spyOn(dataSource, 'query').mockResolvedValue([]);
      jest.spyOn(redis, 'ping').mockResolvedValue('WRONG' as any);

      const result = await service.getReadiness();

      expect(result.status).toBe('not ready');
    });

    it('does not let a hung dependency block the readiness check indefinitely', async () => {
      // ASSUMPTION: getReadiness() has some internal timeout/race so a
      // dependency that never resolves still produces a timely
      // "not ready" result. If your implementation doesn't do this yet,
      // this test documents the gap rather than a passing guarantee —
      // treat a failure here as a real finding, not a broken test.
      jest.spyOn(dataSource, 'query').mockResolvedValue([]);
      jest
        .spyOn(redis, 'ping')
        .mockImplementation(() => new Promise(() => {})); // never resolves

      const result = await service.getReadiness();

      expect(result.status).toBe('not ready');
    }, 3000);
  });
});