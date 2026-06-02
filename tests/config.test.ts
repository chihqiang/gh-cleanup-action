import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Config } from '../src/config';

vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

import * as core from '@actions/core';

const mockGetInput = vi.mocked(core.getInput);
const mockGetBooleanInput = vi.mocked(core.getBooleanInput);
const mockSetFailed = vi.mocked(core.setFailed);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPOSITORY;
});

describe('Config', () => {
  it('should read inputs', () => {
    mockGetInput.mockImplementation((name) => {
      const map: Record<string, string> = {
        token: 'my-token',
        keep_tag: '3',
        keep_release: '5',
        keep_run: '10',
        keep_branch: '2',
      };
      return map[name] ?? '';
    });
    mockGetBooleanInput.mockReturnValue(false);

    const config = new Config();
    expect(config.token).toBe('my-token');
    expect(config.keepTag).toBe(3);
    expect(config.keepRelease).toBe(5);
    expect(config.keepRun).toBe(10);
    expect(config.keepBranch).toBe(2);
    expect(config.dryRun).toBe(false);
  });

  it('should default to 0 when input is empty or invalid', () => {
    mockGetInput.mockReturnValue('');
    mockGetBooleanInput.mockReturnValue(false);

    const config = new Config();
    expect(config.keepTag).toBe(0);
    expect(config.keepRelease).toBe(0);
    expect(config.keepRun).toBe(0);
    expect(config.keepBranch).toBe(0);
  });

  it('should fallback token from env', () => {
    mockGetInput.mockReturnValue('');
    mockGetBooleanInput.mockReturnValue(false);
    process.env.GITHUB_TOKEN = 'env-token';

    const config = new Config();
    expect(config.token).toBe('env-token');
  });

  it('should validate token', () => {
    mockGetInput.mockReturnValue('');
    mockGetBooleanInput.mockReturnValue(false);
    const config = new Config();
    expect(() => config.validate()).toThrow();
    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('token'));
  });

  it('should pass validate with token', () => {
    mockGetInput.mockImplementation((name) => (['token', 'keep_tag'].includes(name) ? '1' : ''));
    mockGetBooleanInput.mockReturnValue(false);
    const config = new Config();
    expect(() => config.validate()).not.toThrow();
  });

  it('should pass validate with all keep values 0', () => {
    mockGetInput.mockImplementation((name) => (name === 'token' ? 'x' : ''));
    mockGetBooleanInput.mockReturnValue(false);
    const config = new Config();
    expect(() => config.validate()).not.toThrow();
  });
});
