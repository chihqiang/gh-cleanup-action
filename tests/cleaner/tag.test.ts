import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TagCleaner } from '../../src/cleaner';
import { mockOctokit } from './helpers';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TagCleaner', () => {
  it('should delete old tags beyond keep count', async () => {
    const { octokit, listTags, deleteRef } = mockOctokit();
    listTags.mockResolvedValue({
      data: [{ name: 'v3.0.0' }, { name: 'v2.0.0' }, { name: 'v1.0.0' }],
    });
    deleteRef.mockResolvedValue({});

    const cleaner = new TagCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(2, false);
    expect(count).toBe(1);
    expect(deleteRef).toHaveBeenCalledTimes(1);
    expect(deleteRef).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', ref: 'tags/v1.0.0' });
  });

  it('should delete all tags when keep is less than total', async () => {
    const { octokit, listTags, deleteRef } = mockOctokit();
    listTags.mockResolvedValue({
      data: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }, { name: 'v3.0.0' }, { name: 'v4.0.0' }],
    });

    const cleaner = new TagCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, false);
    expect(count).toBe(3);
    expect(deleteRef).toHaveBeenCalledTimes(3);
  });

  it('should not delete if keepLatest is 0 (skip)', async () => {
    const { octokit, listTags, deleteRef } = mockOctokit();
    listTags.mockResolvedValue({
      data: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }],
    });

    const cleaner = new TagCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(0, false);
    expect(count).toBe(0);
    expect(deleteRef).not.toHaveBeenCalled();
  });

  it('should not delete when all are within keep limit', async () => {
    const { octokit, listTags, deleteRef } = mockOctokit();
    listTags.mockResolvedValue({
      data: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }],
    });

    const cleaner = new TagCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(5, false);
    expect(count).toBe(0);
    expect(deleteRef).not.toHaveBeenCalled();
  });

  it('should not delete in dry run', async () => {
    const { octokit, listTags, deleteRef } = mockOctokit();
    listTags.mockResolvedValue({
      data: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }],
    });

    const cleaner = new TagCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, true);
    expect(count).toBe(1);
    expect(deleteRef).not.toHaveBeenCalled();
  });
});
