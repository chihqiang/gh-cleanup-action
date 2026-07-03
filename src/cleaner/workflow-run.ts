import { BaseCleaner } from './base';
import { success, error, step, dryRun, info } from '../log';

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
