import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagCleaner, ReleaseCleaner, WorkflowRunCleaner, BranchCleaner } from '../src/cleaner';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

function mockOctokit() {
  const listTags = vi.fn();
  const listReleases = vi.fn();
  const deleteRef = vi.fn();
  const deleteRelease = vi.fn();
  const listBranches = vi.fn();
  const listWorkflowRunsForRepo = vi.fn();
  const deleteWorkflowRun = vi.fn();

  const octokit = {
    rest: {
      repos: { listTags, listReleases, deleteRelease, listBranches },
      git: { deleteRef },
      actions: { listWorkflowRunsForRepo, deleteWorkflowRun },
    },
  } as any;

  return {
    octokit,
    listTags,
    listReleases,
    deleteRef,
    deleteRelease,
    listBranches,
    listWorkflowRunsForRepo,
    deleteWorkflowRun,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TagCleaner', () => {
  describe('clean (tags)', () => {
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

  describe('WorkflowRunCleaner', () => {
    it('should delete old runs beyond keep count', async () => {
      const { octokit, listWorkflowRunsForRepo, deleteWorkflowRun } = mockOctokit();
      listWorkflowRunsForRepo.mockResolvedValue({
        data: {
          total_count: 3,
          workflow_runs: [
            { id: 30, run_number: 3, name: 'CI' },
            { id: 20, run_number: 2, name: 'CI' },
            { id: 10, run_number: 1, name: 'CI' },
          ],
        },
      });
      deleteWorkflowRun.mockResolvedValue({});

      const cleaner = new WorkflowRunCleaner(octokit, 'owner', 'repo');
      const count = await cleaner.clean(2, false);
      expect(count).toBe(1);
      expect(deleteWorkflowRun).toHaveBeenCalledTimes(1);
      expect(deleteWorkflowRun).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', run_id: 10 });
    });

    it('should delete all runs when keep is less than total', async () => {
      const { octokit, listWorkflowRunsForRepo, deleteWorkflowRun } = mockOctokit();
      listWorkflowRunsForRepo.mockResolvedValue({
        data: {
          total_count: 3,
          workflow_runs: [
            { id: 30, run_number: 3, name: 'CI' },
            { id: 20, run_number: 2, name: 'CI' },
            { id: 10, run_number: 1, name: 'CI' },
          ],
        },
      });
      deleteWorkflowRun.mockResolvedValue({});

      const cleaner = new WorkflowRunCleaner(octokit, 'owner', 'repo');
      const count = await cleaner.clean(1, false);
      expect(count).toBe(2);
      expect(deleteWorkflowRun).toHaveBeenCalledTimes(2);
    });

    it('should handle runs from different workflows', async () => {
      const { octokit, listWorkflowRunsForRepo, deleteWorkflowRun } = mockOctokit();
      listWorkflowRunsForRepo.mockResolvedValue({
        data: {
          total_count: 3,
          workflow_runs: [
            { id: 30, run_number: 3, name: 'CI' },
            { id: 20, run_number: 2, name: 'Deploy' },
            { id: 10, run_number: 1, name: 'CI' },
          ],
        },
      });
      deleteWorkflowRun.mockResolvedValue({});

      const cleaner = new WorkflowRunCleaner(octokit, 'owner', 'repo');
      const count = await cleaner.clean(1, false);
      expect(count).toBe(2);
    });

    it('should not delete in dry run', async () => {
      const { octokit, listWorkflowRunsForRepo, deleteWorkflowRun } = mockOctokit();
      listWorkflowRunsForRepo.mockResolvedValue({
        data: { total_count: 1, workflow_runs: [{ id: 10, run_number: 1, name: 'CI' }] },
      });

      const cleaner = new WorkflowRunCleaner(octokit, 'owner', 'repo');
      const count = await cleaner.clean(0, true);
      expect(count).toBe(0);
      expect(deleteWorkflowRun).not.toHaveBeenCalled();
    });
  });

  describe('BranchCleaner', () => {
    function makeBranch(name: string, date: string, isProtected: boolean) {
      return { name, commit: { commit: { committer: { date } } }, protected: isProtected };
    }

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
});
