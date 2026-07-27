import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';

type DependencyStatus = 'up' | 'down';

interface DependencyHealth {
  status: DependencyStatus;
  latencyMs: number;
  error?: string;
}

interface ReadinessResult {
  status: 'ready' | 'not ready';
  timestamp: string;
  details: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
}

// How long a single dependency check is allowed to take before it's
// treated as failed. Without this, a hung DB/Redis connection would leave
// getReadiness() (and whatever's polling it — a k8s readiness probe, an
// LB health check) waiting forever instead of failing fast.
const CHECK_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: Redis,
  ) {}

  getLiveness() {
    return {
      status: 'alive' as const,
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResult> {
    // Run both checks concurrently rather than awaiting them one after the
    // other — a slow DB shouldn't add its latency on top of a slow Redis
    // check. Each check catches its own errors (see below), so this never
    // rejects.
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status =
      database.status === 'up' && redis.status === 'up' ? 'ready' : 'not ready';

    return {
      status,
      timestamp: new Date().toISOString(),
      details: { database, redis },
    };
  }

  async getStartup() {
    return {
      status: 'started' as const,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      await this.withTimeout(
        this.dataSource.query('SELECT 1'),
        CHECK_TIMEOUT_MS,
      );
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      const error = this.errorMessage(err);
      this.logger.warn(`Database health check failed: ${error}`);
      return { status: 'down', latencyMs: Date.now() - start, error };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const reply = await this.withTimeout(this.redis.ping(), CHECK_TIMEOUT_MS);
      // A resolved ping isn't automatically a healthy ping — a
      // misbehaving client/proxy could resolve with something other than
      // "PONG" without ever throwing. Treat that as a failure too.
      if (reply !== 'PONG') {
        throw new Error(`unexpected PING reply: "${reply}"`);
      }
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      const error = this.errorMessage(err);
      this.logger.warn(`Redis health check failed: ${error}`);
      return { status: 'down', latencyMs: Date.now() - start, error };
    }
  }

  /** Rejects with a timeout error if `promise` hasn't settled within `ms`. */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${ms}ms`)),
        ms,
      );
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}