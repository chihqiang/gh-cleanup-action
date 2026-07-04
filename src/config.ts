import * as core from '@actions/core';

function parseKeep(value: string): number {
  if (!value) return 0;
  const n = parseInt(value, 10);
  return isNaN(n) ? 0 : n;
}

export class Config {
  readonly token: string;
  readonly keepTag: number;
  readonly keepRelease: number;
  readonly keepRun: number;
  readonly keepBranch: number;
  readonly keepActionCache: number;
  readonly dryRun: boolean;

  constructor() {
    this.token = core.getInput('token') || process.env.GITHUB_TOKEN || '';
    this.keepTag = parseKeep(core.getInput('keep_tag'));
    this.keepRelease = parseKeep(core.getInput('keep_release'));
    this.keepRun = parseKeep(core.getInput('keep_run'));
    this.keepBranch = parseKeep(core.getInput('keep_branch'));
    this.keepActionCache = parseKeep(core.getInput('keep_action_cache'));
    const dryRunInput = core.getInput('dry_run') || 'true';
    this.dryRun = dryRunInput.toLowerCase() === 'true';
  }

  validate(): void {
    if (!this.token) {
      core.setFailed('token is required');
      process.exit(1);
    }
  }
}
