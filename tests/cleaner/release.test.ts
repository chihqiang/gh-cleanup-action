import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReleaseCleaner } from '../../src/cleaner';
import { mockOctokit } from './helpers';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ReleaseCleaner', () => {
  it('should delete old releases beyond keep count', async () => {
    const { octokit, listReleases, deleteRelease } = mockOctokit();
    listReleases.mockResolvedValue({
      data: [
        { id: 3, tag_name: 'v3.0.0' },
        { id: 2, tag_name: 'v2.0.0' },
        { id: 1, tag_name: 'v1.0.0' },
      ],
    });

    const cleaner = new ReleaseCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(2, false);
    expect(count).toBe(1);
    expect(deleteRelease).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', release_id: 1 });
  });

  it('should delete all releases when keep is less than total', async () => {
    const { octokit, listReleases, deleteRelease } = mockOctokit();
    listReleases.mockResolvedValue({
      data: [
        { id: 1, tag_name: 'v1.0.0' },
        { id: 2, tag_name: 'v2.0.0' },
        { id: 3, tag_name: 'v3.0.0' },
      ],
    });

    const cleaner = new ReleaseCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, false);
    expect(count).toBe(2);
    expect(deleteRelease).toHaveBeenCalledTimes(2);
  });

  it('should not delete in dry run', async () => {
    const { octokit, listReleases, deleteRelease } = mockOctokit();
    listReleases.mockResolvedValue({
      data: [
        { id: 1, tag_name: 'v1.0.0' },
        { id: 2, tag_name: 'v2.0.0' },
      ],
    });

    const cleaner = new ReleaseCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, true);
    expect(count).toBe(1);
    expect(deleteRelease).not.toHaveBeenCalled();
  });
});
