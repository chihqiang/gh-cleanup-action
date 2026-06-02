import { GitHub } from '@actions/github/lib/utils';
import { success, error, step, dryRun, info, warning } from './log';

export interface CleanupStats {
  deletedTags: number;
  deletedReleases: number;
  deletedRuns: number;
  deletedBranches: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export abstract class BaseCleaner {
  protected octokit: InstanceType<typeof GitHub>;
  protected owner: string;
  protected repoName: string;

  constructor(octokit: InstanceType<typeof GitHub>, owner: string, repoName: string) {
    this.octokit = octokit;
    this.owner = owner;
    this.repoName = repoName;
  }

  abstract clean(keepLatest: number, dryRunMode: boolean): Promise<number>;

  protected async withRetry<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const message = (err as Error).message;
        if (attempt < retries) {
          const delay = 1000 * 2 ** (attempt - 1);
          warning(`${label} failed (attempt ${attempt}/${retries}): ${message}, retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
    throw new Error(`${label} failed after ${retries} attempts`, { cause: lastError });
  }

  protected async paginate<T>(
    apiFn: (params: any) => Promise<{ data: T[] }>,
    params: Record<string, unknown>,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const response = await apiFn({ ...params, page });
      results.push(...response.data);
      if (response.data.length < ((params.per_page as number) || 100)) break;
      page++;
    }

    return results;
  }

  protected async paginateNested<T>(
    apiFn: (params: any) => Promise<{ data: Record<string, unknown> }>,
    params: Record<string, unknown>,
    key: string,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const response = await apiFn({ ...params, page });
      const items = response.data[key] as T[];
      results.push(...items);
      if (items.length < ((params.per_page as number) || 100)) break;
      page++;
    }

    return results;
  }
}

export class TagCleaner extends BaseCleaner {
  async clean(keepLatest: number, dryRunMode: boolean): Promise<number> {
    if (keepLatest <= 0) return 0;
    const tags = await this.paginate(this.octokit.rest.repos.listTags, {
      owner: this.owner,
      repo: this.repoName,
      per_page: 100,
    });

    if (tags.length === 0) {
      info('No tags found');
      return 0;
    }

    if (tags.length <= keepLatest) {
      info(`Tags (${tags.length}) within keep=${keepLatest} limit, nothing to delete`);
      return 0;
    }

    const toDelete = tags.slice(keepLatest);
    step(`Tags to delete: ${toDelete.length} (keeping latest ${keepLatest} of ${tags.length})`);

    for (const tag of toDelete) {
      if (dryRunMode) {
        dryRun(`Would delete tag: ${tag.name}`);
      } else {
        try {
          await this.withRetry(
            () =>
              this.octokit.rest.git.deleteRef({
                owner: this.owner,
                repo: this.repoName,
                ref: `tags/${tag.name}`,
              }),
            `Delete tag ${tag.name}`,
          );
          success(`Deleted tag: ${tag.name}`);
        } catch (err) {
          error((err as Error).message);
        }
      }
    }

    return toDelete.length;
  }
}

export class ReleaseCleaner extends BaseCleaner {
  async clean(keepLatest: number, dryRunMode: boolean): Promise<number> {
    if (keepLatest <= 0) return 0;
    const releases = await this.paginate(this.octokit.rest.repos.listReleases, {
      owner: this.owner,
      repo: this.repoName,
      per_page: 100,
    });

    if (releases.length === 0) {
      info('No releases found');
      return 0;
    }

    if (releases.length <= keepLatest) {
      info(`Releases (${releases.length}) within keep=${keepLatest} limit, nothing to delete`);
      return 0;
    }

    const toDelete = releases.slice(keepLatest);
    step(`Releases to delete: ${toDelete.length} (keeping latest ${keepLatest} of ${releases.length})`);

    for (const release of toDelete) {
      if (dryRunMode) {
        dryRun(`Would delete release: ${release.tag_name} (ID: ${release.id})`);
      } else {
        try {
          await this.withRetry(
            () =>
              this.octokit.rest.repos.deleteRelease({
                owner: this.owner,
                repo: this.repoName,
                release_id: release.id,
              }),
            `Delete release ${release.tag_name}`,
          );
          success(`Deleted release: ${release.tag_name}`);
        } catch (err) {
          error((err as Error).message);
        }
      }
    }

    return toDelete.length;
  }
}

export class WorkflowRunCleaner extends BaseCleaner {
  async clean(keepLatest: number, dryRunMode: boolean): Promise<number> {
    if (keepLatest <= 0) return 0;
    const runs = await this.paginateNested<any>(
      this.octokit.rest.actions.listWorkflowRunsForRepo as any,
      { owner: this.owner, repo: this.repoName, per_page: 100 },
      'workflow_runs',
    );

    if (runs.length === 0) {
      info('No workflow runs found');
      return 0;
    }

    if (runs.length <= keepLatest) {
      info(`Workflow runs (${runs.length}) within keep=${keepLatest} limit, nothing to delete`);
      return 0;
    }

    const toDelete = runs.slice(keepLatest);
    step(
      `Workflow runs to delete: ${toDelete.length} (keeping latest ${keepLatest} of ${runs.length} across all workflows)`,
    );

    for (const run of toDelete) {
      if (dryRunMode) {
        dryRun(`Would delete run #${run.run_number} (ID: ${run.id})`);
      } else {
        try {
          await this.withRetry(
            () =>
              this.octokit.rest.actions.deleteWorkflowRun({
                owner: this.owner,
                repo: this.repoName,
                run_id: run.id,
              }),
            `Delete run #${run.run_number}`,
          );
          success(`Deleted run #${run.run_number} from "${run.name}"`);
        } catch (err) {
          error((err as Error).message);
        }
      }
    }

    return toDelete.length;
  }
}

export class BranchCleaner extends BaseCleaner {
  async clean(keepLatest: number, dryRunMode: boolean): Promise<number> {
    if (keepLatest <= 0) return 0;
    const branches = await this.paginate(this.octokit.rest.repos.listBranches, {
      owner: this.owner,
      repo: this.repoName,
      per_page: 100,
    });

    if (branches.length === 0) {
      info('No branches found');
      return 0;
    }

    const nonProtected = branches.filter((b: any) => !b.protected);
    const protectedCount = branches.length - nonProtected.length;

    if (nonProtected.length === 0) {
      info('No non-protected branches to delete');
      return 0;
    }

    nonProtected.sort((a: any, b: any) => {
      const da = a.commit?.commit?.committer?.date ? new Date(a.commit.commit.committer.date).getTime() : 0;
      const db = b.commit?.commit?.committer?.date ? new Date(b.commit.commit.committer.date).getTime() : 0;
      return db - da;
    });

    if (nonProtected.length <= keepLatest) {
      info(`Non-protected branches (${nonProtected.length}) within keep=${keepLatest} limit, nothing to delete`);
      return 0;
    }

    const toDelete = nonProtected.slice(keepLatest);
    step(
      `Branches to delete: ${toDelete.length} (keeping latest ${keepLatest} of ${nonProtected.length} non-protected, ${protectedCount} protected skipped)`,
    );

    for (const branch of toDelete) {
      if (dryRunMode) {
        dryRun(`Would delete branch: ${branch.name}`);
      } else {
        try {
          await this.withRetry(
            () =>
              this.octokit.rest.git.deleteRef({
                owner: this.owner,
                repo: this.repoName,
                ref: `heads/${branch.name}`,
              }),
            `Delete branch ${branch.name}`,
          );
          success(`Deleted branch: ${branch.name}`);
        } catch (err) {
          error((err as Error).message);
        }
      }
    }

    return toDelete.length;
  }
}
