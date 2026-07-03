import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BranchCleaner } from '../../src/cleaner';
import { mockOctokit } from './helpers';

beforeEach(() => {
  vi.resetAllMocks();
});

function makeBranch(name: string, date: string, isProtected: boolean) {
  return { name, commit: { commit: { committer: { date } } }, protected: isProtected };
}

describe('BranchCleaner', () => {
  it('should delete non-protected branches beyond keep count', async () => {
    const { octokit, listBranches, deleteRef } = mockOctokit();
    listBranches.mockResolvedValue({
      data: [
        makeBranch('main', '2024-03-10T00:00:00Z', true),
        makeBranch('feature-c', '2024-03-09T00:00:00Z', false),
        makeBranch('feature-b', '2024-03-08T00:00:00Z', false),
        makeBranch('feature-a', '2024-03-07T00:00:00Z', false),
      ],
    });

    const cleaner = new BranchCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, false);
    expect(count).toBe(2);
    expect(deleteRef).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'heads/feature-b',
    });
    expect(deleteRef).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'heads/feature-a',
    });
    expect(deleteRef).not.toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'heads/main',
    });
  });

  it('should skip when keepLatest is 0', async () => {
    const { octokit, listBranches, deleteRef } = mockOctokit();
    listBranches.mockResolvedValue({
      data: [makeBranch('main', '2024-03-10T00:00:00Z', true), makeBranch('dev', '2024-03-09T00:00:00Z', false)],
    });

    const cleaner = new BranchCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(0, false);
    expect(count).toBe(0);
    expect(deleteRef).not.toHaveBeenCalled();
  });

  it('should skip in dry run when keepLatest is 0', async () => {
    const { octokit, listBranches, deleteRef } = mockOctokit();
    listBranches.mockResolvedValue({
      data: [makeBranch('main', '2024-03-10T00:00:00Z', false)],
    });

    const cleaner = new BranchCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(0, true);
    expect(count).toBe(0);
    expect(deleteRef).not.toHaveBeenCalled();
  });

  it('should do nothing when no non-protected branches', async () => {
    const { octokit, listBranches, deleteRef } = mockOctokit();
    listBranches.mockResolvedValue({
      data: [makeBranch('main', '2024-03-10T00:00:00Z', true)],
    });

    const cleaner = new BranchCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, false);
    expect(count).toBe(0);
    expect(deleteRef).not.toHaveBeenCalled();
  });

  it('should sort by commit date and keep newest', async () => {
    const { octokit, listBranches, deleteRef } = mockOctokit();
    listBranches.mockResolvedValue({
      data: [
        makeBranch('old', '2024-01-01T00:00:00Z', false),
        makeBranch('new', '2024-06-01T00:00:00Z', false),
        makeBranch('mid', '2024-03-01T00:00:00Z', false),
      ],
    });

    const cleaner = new BranchCleaner(octokit, 'owner', 'repo');
    const count = await cleaner.clean(1, false);
    expect(count).toBe(2);
    expect(deleteRef).toHaveBeenCalledWith(expect.objectContaining({ ref: 'heads/mid' }));
    expect(deleteRef).toHaveBeenCalledWith(expect.objectContaining({ ref: 'heads/old' }));
    expect(deleteRef).not.toHaveBeenCalledWith(expect.objectContaining({ ref: 'heads/new' }));
  });
});
