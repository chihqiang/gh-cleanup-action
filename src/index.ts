import * as core from '@actions/core';
import * as github from '@actions/github';
import { info, error, success, step } from './log';
import { Config } from './config';
import { CleanupStats, TagCleaner, ReleaseCleaner, WorkflowRunCleaner, BranchCleaner, CacheCleaner } from './cleaner';

async function main(): Promise<void> {
  try {
    const config = new Config();
    config.validate();

    info(`GitHub Repository: ${process.env.GITHUB_REPOSITORY || ''}`);
    info(`Dry Run: ${config.dryRun ? 'yes' : 'no'}`);

    if (config.keepTag > 0) {
      info(`Tags: keep latest ${config.keepTag}`);
    }
    if (config.keepRelease > 0) {
      info(`Releases: keep latest ${config.keepRelease}`);
    }
    if (config.keepRun > 0) {
      info(`Workflow Runs: keep latest ${config.keepRun} across all workflows`);
    }
    if (config.keepBranch > 0) {
      info(`Branches: keep latest ${config.keepBranch} (protected branches excluded)`);
    }
    if (config.keepActionCache > 0) {
      info(`Action Caches: keep latest ${config.keepActionCache}`);
    }

    const { owner, repo: repoName } = github.context.repo;
    const octokit = github.getOctokit(config.token);

    const stats: CleanupStats = {
      deletedTags: 0,
      deletedReleases: 0,
      deletedRuns: 0,
      deletedBranches: 0,
      deletedActionCaches: 0,
    };

    if (config.keepTag > 0) {
      step('Cleaning up tags...');
      const cleaner = new TagCleaner(octokit, owner, repoName);
      stats.deletedTags = await cleaner.clean(config.keepTag, config.dryRun);
    }

    if (config.keepRelease > 0) {
      step('Cleaning up releases...');
      const cleaner = new ReleaseCleaner(octokit, owner, repoName);
      stats.deletedReleases = await cleaner.clean(config.keepRelease, config.dryRun);
    }

    if (config.keepRun > 0) {
      step('Cleaning up workflow runs...');
      const cleaner = new WorkflowRunCleaner(octokit, owner, repoName);
      stats.deletedRuns = await cleaner.clean(config.keepRun, config.dryRun);
    }

    if (config.keepBranch > 0) {
      step('Cleaning up branches...');
      const cleaner = new BranchCleaner(octokit, owner, repoName);
      stats.deletedBranches = await cleaner.clean(config.keepBranch, config.dryRun);
    }

    if (config.keepActionCache > 0) {
      step('Cleaning up action caches...');
      const cleaner = new CacheCleaner(octokit, owner, repoName);
      stats.deletedActionCaches = await cleaner.clean(config.keepActionCache, config.dryRun);
    }

    core.setOutput('deleted_tags', stats.deletedTags);
    core.setOutput('deleted_releases', stats.deletedReleases);
    core.setOutput('deleted_runs', stats.deletedRuns);
    core.setOutput('deleted_branches', stats.deletedBranches);
    core.setOutput('deleted_action_caches', stats.deletedActionCaches);

    const total =
      stats.deletedTags + stats.deletedReleases + stats.deletedRuns + stats.deletedBranches + stats.deletedActionCaches;
    if (total === 0) {
      success('Nothing to clean up');
    } else {
      success(
        `Cleanup complete: ${stats.deletedTags} tag(s), ${stats.deletedReleases} release(s), ${stats.deletedRuns} workflow run(s), ${stats.deletedBranches} branch(es), ${stats.deletedActionCaches} action cache(s)`,
      );
    }
  } catch (err) {
    const message = (err as Error)?.message ?? err;
    error(message as string);
    core.setFailed(String(message));
  }
}

main();
