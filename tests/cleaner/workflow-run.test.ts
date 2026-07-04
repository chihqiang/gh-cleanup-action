import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowRunCleaner } from '../../src/cleaner';
import { mockOctokit } from './helpers';

beforeEach(() => {
  vi.resetAllMocks();
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
