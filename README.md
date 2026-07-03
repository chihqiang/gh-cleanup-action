# gh-cleanup-action

自动清理无用的 Git Tags、Releases、过期的 GitHub Actions 工作流运行记录、过期的分支以及 Actions Cache。

## 使用示例

```yaml
name: Cleanup

on:
  schedule:
    - cron: '0 0 * * 0'  # 每周日凌晨执行
  workflow_dispatch:

permissions:
  contents: write
  actions: write

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Clean up tags, releases, workflow runs, branches & caches
        uses: chihqiang/gh-cleanup-action@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          keep_tag: 1
          keep_release: 1
          keep_run: 1
          keep_branch: 1
          keep_action_cache: 1
          dry_run: false
```

> 以上配置表示：tag、release、工作流运行记录（所有工作流合计）、分支（排除保护分支）和 Actions Cache 各保留最新 1 条/个，其余的会被删除。`dry_run: false` 表示实际执行删除。

> **注意**：需要 `contents: write` 权限来删除 tags、releases 和 branches，`actions: write` 权限来删除 workflow runs 和 caches。`GITHUB_TOKEN` 默认无写入权限，必须通过 `permissions` 显式开启。

## 输入参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `token` | `${{ github.token }}` | GitHub Token，需 `repo` 权限 |
| `keep_tag` | `0` | 保留最新 N 个 tags。超过此数量时删除旧的。`0` 或空 = 不处理 |
| `keep_release` | `0` | 保留最新 N 个 releases。超过此数量时删除旧的。`0` 或空 = 不处理 |
| `keep_run` | `0` | 保留最新 N 条工作流运行记录（所有工作流合计）。超过此数量时删除旧的。`0` 或空 = 不处理 |
| `keep_branch` | `0` | 保留最新 N 个非保护分支。保护分支不会被删除。`0` 或空 = 不处理 |
| `keep_action_cache` | `0` | 保留最新 N 个 Actions Cache（按创建时间排序）。超过此数量时删除旧的。`0` 或空 = 不处理 |
| `dry_run` | `true` | 预览模式 — 只列出要删除的内容，不实际执行删除 |

## 输出

| 输出 | 说明 |
|------|------|
| `deleted_tags` | 已删除的 tag 数量 |
| `deleted_releases` | 已删除的 release 数量 |
| `deleted_runs` | 已删除的工作流运行数量 |
| `deleted_branches` | 已删除的分支数量 |
| `deleted_action_caches` | 已删除的 Actions Cache 数量 |

## 开发

```bash
npm install
npm test
npm run build
```
