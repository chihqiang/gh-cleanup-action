import { BaseCleaner } from './base';
import { success, error, step, dryRun, info } from '../log';

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
