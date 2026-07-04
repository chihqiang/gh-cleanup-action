import { GitHub } from '@actions/github/lib/utils';
import { warning } from '../log';

export interface CleanupStats {
  deletedTags: number;
  deletedReleases: number;
  deletedRuns: number;
  deletedBranches: number;
  deletedActionCaches: number;
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
