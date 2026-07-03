import { BaseCleaner } from './base';
import { success, error, step, dryRun, info } from '../log';

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
