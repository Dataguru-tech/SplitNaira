/**
 * Shared contract fixtures verifying dual-casing compatibility (snake_case and camelCase)
 * across frontend client mapping and backend API responses.
 */

export interface SplitResponseCamelCase {
  id: string;
  title: string;
  targetAmount: number;
  totalRaised: number;
  createdAt: string;
  updatedAt: string;
}

export interface SplitResponseSnakeCase {
  id: string;
  title: string;
  target_amount: number;
  total_raised: number;
  created_at: string;
  updated_at: string;
}

export const splitCamelCaseFixture: SplitResponseCamelCase = {
  id: 'split_9988776655',
  title: 'Community School Fund Drive',
  targetAmount: 500000,
  totalRaised: 125000,
  createdAt: '2026-07-20T12:00:00.000Z',
  updatedAt: '2026-07-21T15:30:00.000Z',
};

export const splitSnakeCaseFixture: SplitResponseSnakeCase = {
  id: 'split_9988776655',
  title: 'Community School Fund Drive',
  target_amount: 500000,
  total_raised: 125000,
  created_at: '2026-07-20T12:00:00.000Z',
  updated_at: '2026-07-21T15:30:00.000Z',
};

/**
 * Frontend client mapper function supporting both camelCase and legacy/snake_case API payloads.
 */
export function mapSplitResponse(payload: Partial<SplitResponseCamelCase & SplitResponseSnakeCase>): SplitResponseCamelCase {
  return {
    id: payload.id ?? '',
    title: payload.title ?? '',
    targetAmount: payload.targetAmount ?? payload.target_amount ?? 0,
    totalRaised: payload.totalRaised ?? payload.total_raised ?? 0,
    createdAt: payload.createdAt ?? payload.created_at ?? '',
    updatedAt: payload.updatedAt ?? payload.updated_at ?? '',
  };
}
