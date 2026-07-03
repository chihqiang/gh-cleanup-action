import { BaseCleaner } from './base';
import { success, error, step, dryRun, info } from '../log';

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
