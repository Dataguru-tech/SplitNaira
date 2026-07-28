import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import { rateLimiter } from '../rateLimiter'; // Adjust path to match your rate-limiter middleware location

describe('Rate Limiter Middleware Header & Response Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Middleware to attach correlation ID for testing
    app.use((req: Request, res: Response, next) => {
      const correlationId = req.headers['x-correlation-id'] || 'test-correlation-id-123';
      req.headers['x-correlation-id'] = correlationId as string;
      res.setHeader('x-correlation-id', correlationId as string);
      next();
    });

    // Protected route with a tight limit for testing (e.g., 3 requests max)
    app.use('/api/protected', rateLimiter({ maxRequests: 3, windowMs: 60 * 1000 }));
    app.get('/api/protected', (req: Request, res: Response) => {
      res.status(200).json({ success: true, message: 'Protected resource accessed' });
    });
  });

  it('should return rate-limit headers on normal requests', async () => {
    const response = await request(app)
      .get('/api/protected')
      .set('x-correlation-id', 'corr-req-1');

    expect(response.status).toBe(200);
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    expect(response.headers).toHaveProperty('x-ratelimit-reset');

    expect(response.headers['x-ratelimit-limit']).toBe('3');
    expect(response.headers['x-ratelimit-remaining']).toBe('2');
  });

  it('should accurately decrement remaining count in near-limit state', async () => {
    // Request 1
    const req1 = await request(app).get('/api/protected');
    expect(req1.headers['x-ratelimit-remaining']).toBe('2');

    // Request 2 (Near Limit)
    const req2 = await request(app).get('/api/protected');
    expect(req2.headers['x-ratelimit-remaining']).toBe('1');

    // Request 3 (At Limit)
    const req3 = await request(app).get('/api/protected');
    expect(req3.headers['x-ratelimit-remaining']).toBe('0');
    expect(req3.status).toBe(200);
  });

  it('should return 429 with stable error shape and correlation ID when limit is exceeded', async () => {
    const correlationId = 'corr-exceeded-456';

    // Exhaust limit (3 requests)
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/protected').set('x-correlation-id', correlationId);
    }

    // Exceeded Request (4th call)
    const response = await request(app)
      .get('/api/protected')
      .set('x-correlation-id', correlationId);

    expect(response.status).toBe(429);
    expect(response.headers['x-correlation-id']).toBe(correlationId);

    // Validate rate-limit header state on 429
    expect(response.headers['x-ratelimit-remaining']).toBe('0');
    expect(response.headers).toHaveProperty('retry-after');

    // Assert stable error response shape
    expect(response.body).toMatchObject({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: expect.stringMatching(/rate limit exceeded/i),
        correlationId: correlationId,
      },
    });
  });
});