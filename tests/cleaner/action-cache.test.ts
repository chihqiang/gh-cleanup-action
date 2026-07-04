import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheCleaner } from '../../src/cleaner';
import { mockOctokit } from './helpers';

beforeEach(() => {
  vi.resetAllMocks();
});

function makeCache(id: number, key: string, size_in_bytes: number) {
  return {
    id,
    key,
    size_in_bytes,
    ref: 'refs/heads/main',
    version: 'v1',
    created_at: '2024-01-01T00:00:00Z',
    last_accessed_at: '2024-01-01T00:00:00Z',
  };
}

describe('CacheCleaner', () => {
  it('should delete old caches beyond keep count', async () => {
    const { octokit, request } = mockOctokit();
    request.mockResolvedValue({
      data: {
        total_count: 3,
        actions_caches: [makeCache(3, 'cache-c', 1024), makeCache(2, 'cache-b', 2048), makeCache(1, 'cache-a', 512)],
      },
    });

    const cleaner = new CacheCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(2, false);
    expect(count).toBe(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, 'GET /repos/{owner}/{repo}/actions/caches', {
      owner: 'owner',
      repo: 'repo',
      per_page: 100,
      sort: 'created_at',
      direction: 'desc',
      page: 1,
    });
    expect(request).toHaveBeenNthCalledWith(2, 'DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}', {
      owner: 'owner',
      repo: 'repo',
      cache_id: 1,
    });
  });

  it('should delete all caches when keep is less than total', async () => {
    const { octokit, request } = mockOctokit();
    request.mockResolvedValue({
      data: {
        total_count: 2,
        actions_caches: [makeCache(2, 'cache-b', 1024), makeCache(1, 'cache-a', 1024)],
      },
    });

    const cleaner = new CacheCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(0, false);
    expect(count).toBe(0);
    expect(request).not.toHaveBeenCalled();
  });

  it('should not delete when all are within keep limit', async () => {
    const { octokit, request } = mockOctokit();
    request.mockResolvedValue({
      data: {
        total_count: 2,
        actions_caches: [makeCache(2, 'cache-b', 1024), makeCache(1, 'cache-a', 1024)],
      },
    });

    const cleaner = new CacheCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(5, false);
    expect(count).toBe(0);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should not delete in dry run', async () => {
    const { octokit, request } = mockOctokit();
    request.mockResolvedValue({
      data: {
        total_count: 2,
        actions_caches: [makeCache(2, 'cache-b', 1024), makeCache(1, 'cache-a', 1024)],
      },
    });

    const cleaner = new CacheCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, true);
    expect(count).toBe(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalledWith(
      'DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}',
      expect.anything(),
    );
  });
});
