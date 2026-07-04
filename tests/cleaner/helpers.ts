import { vi } from 'vitest';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

export function mockOctokit() {
  const listTags = vi.fn();
  const listReleases = vi.fn();
  const deleteRef = vi.fn();
  const deleteRelease = vi.fn();
  const listBranches = vi.fn();
  const listWorkflowRunsForRepo = vi.fn();
  const deleteWorkflowRun = vi.fn();
  const request = vi.fn();

  const octokit = {
    rest: {
      repos: { listTags, listReleases, deleteRelease, listBranches },
      git: { deleteRef },
      actions: { listWorkflowRunsForRepo, deleteWorkflowRun },
    },
    request,
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
    request,
  };
}
