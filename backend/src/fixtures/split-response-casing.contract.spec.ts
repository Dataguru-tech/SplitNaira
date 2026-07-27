import {
  splitCamelCaseFixture,
  splitSnakeCaseFixture,
  mapSplitResponse,
} from '../fixtures/split-response.fixtures';

describe('Split Response Casing Compatibility Contract (#825)', () => {
  describe('Frontend Mapper Casing Normalization', () => {
    it('correctly maps camelCase payloads to unified entity state', () => {
      const mapped = mapSplitResponse(splitCamelCaseFixture);

      expect(mapped).toEqual({
        id: 'split_9988776655',
        title: 'Community School Fund Drive',
        targetAmount: 500000,
        totalRaised: 125000,
        createdAt: '2026-07-20T12:00:00.000Z',
        updatedAt: '2026-07-21T15:30:00.000Z',
      });
    });

    it('correctly maps snake_case payloads to unified entity state', () => {
      const mapped = mapSplitResponse(splitSnakeCaseFixture);

      expect(mapped).toEqual({
        id: 'split_9988776655',
        title: 'Community School Fund Drive',
        targetAmount: 500000,
        totalRaised: 125000,
        createdAt: '2026-07-20T12:00:00.000Z',
        updatedAt: '2026-07-21T15:30:00.000Z',
      });
    });
  });

  describe('API Endpoint Response Contracts (List, Detail, Create, Update)', () => {
    it('covers LIST response contract mapping for both casing formats', () => {
      const apiListResponse = {
        data: [splitCamelCaseFixture, splitSnakeCaseFixture],
      };

      const normalizedList = apiListResponse.data.map(mapSplitResponse);

      expect(normalizedList).toHaveLength(2);
      expect(normalizedList[0].targetAmount).toBe(500000);
      expect(normalizedList[1].targetAmount).toBe(500000);
    });

    it('covers DETAIL GET response contract mapping', () => {
      const mappedDetail = mapSplitResponse(splitSnakeCaseFixture);
      expect(mappedDetail.id).toBe('split_9988776655');
      expect(mappedDetail.totalRaised).toBe(125000);
    });

    it('covers CREATE POST response contract mapping', () => {
      const createResponsePayload = {
        ...splitSnakeCaseFixture,
        total_raised: 0,
      };

      const mappedCreate = mapSplitResponse(createResponsePayload);
      expect(mappedCreate.totalRaised).toBe(0);
      expect(mappedCreate.targetAmount).toBe(500000);
    });

    it('covers UPDATE PATCH response contract mapping', () => {
      const updateResponsePayload = {
        ...splitCamelCaseFixture,
        title: 'Updated School Fund Drive',
        targetAmount: 750000,
      };

      const mappedUpdate = mapSplitResponse(updateResponsePayload);
      expect(mappedUpdate.title).toBe('Updated School Fund Drive');
      expect(mappedUpdate.targetAmount).toBe(750000);
    });
  });
});