import { BaseCleaner } from './base';
import { success, error, step, dryRun, info } from '../log';

export class CacheCleaner extends BaseCleaner {
  async clean(keepLatest: number, dryRunMode: boolean): Promise<number> {
    if (keepLatest <= 0) return 0;

    const listCaches = (params: any) => this.octokit.request('GET /repos/{owner}/{repo}/actions/caches', params);

    const caches = await this.paginateNested<any>(
      listCaches as any,
      {
        owner: this.owner,
        repo: this.repoName,
        per_page: 100,
        sort: 'created_at',
        direction: 'desc',
      },
      'actions_caches',
    );

    if (caches.length === 0) {
      info('No caches found');
      return 0;
    }

    if (caches.length <= keepLatest) {
      info(`Caches (${caches.length}) within keep=${keepLatest} limit, nothing to delete`);
      return 0;
    }

    const toDelete = caches.slice(keepLatest);
    step(`Caches to delete: ${toDelete.length} (keeping latest ${keepLatest} of ${caches.length})`);

    for (const cache of toDelete) {
      if (dryRunMode) {
        dryRun(`Would delete cache: ${cache.key} (${(cache.size_in_bytes / 1024).toFixed(0)} KB)`);
      } else {
        try {
          await this.withRetry(
            () =>
              this.octokit.request('DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}', {
                owner: this.owner,
                repo: this.repoName,
                cache_id: cache.id,
              }),
            `Delete cache ${cache.key}`,
          );
          success(`Deleted cache: ${cache.key}`);
        } catch (err) {
          error((err as Error).message);
        }
      }
    }

    return toDelete.length;
  }
}
