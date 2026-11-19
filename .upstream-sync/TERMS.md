# 术语表 — 翻译一致性参考

本文档用于确保所有文档翻译的术语一致性。AI 翻译时应参考此表。

## 产品与工具名（不译）

| 原文 | 备注 |
|------|------|
| Orca | 产品名 |
| Claude Code | AI 代理 |
| Codex | AI 代理 |
| Cursor CLI | AI 代理 |
| OpenCode | AI 代理 |
| Devin | AI 代理 |
| Antigravity | AI 代理 |
| Linear | 项目管理工具 |
| GitLab | 代码托管 |
| GitHub | 代码托管 |
| Ghostty | 终端 |
| VS Code | IDE |
| Signal | 通讯应用 |
| Homebrew | macOS 包管理器 |
| Tailwind | CSS 框架 |
| Vercel | 部署平台 |
| Next.js | React 框架 |
| React | UI 库 |
| Fumadocs | 文档框架 |
| OxLint | Linter |
| PowerShell | Shell |
| CMD | Shell |
| GNOME | 桌面环境 |
| AUR | Arch User Repository |
| Nix | 包管理器 |

## 技术缩写（不译）

CLI, API, HTTP, HTTPS, JSON, YAML, MDX, UI, UX, IDE, MCP, SSH, WSL, VM, RC, x64, arm64, amd64, aarch64, PTY, LAN, macOS, Linux, Windows, PR, diff, hook

## 通用术语

| 原文 | 译文 | 备注 |
|------|------|------|
| agent | 代理 | AI coding agent |
| worktree | 工作树 | git worktree |
| terminal | 终端 | |
| session | 会话 | |
| branch | 分支 | git 概念 |
| commit | 提交 | git 概念 |
| repository | 仓库 | git 仓库 |
| base ref | 基础引用 | git 分支起点 |
| diff | diff / 差异 | 保持技术术语 |
| hook | 钩子 | |
| automation | 自动化任务 | |
| orchestration | 编排 | |
| Remote Server | 远程服务器 | |
| headless | 无头 | 无界面服务器 |
| desktop app | 桌面应用 | |
| launcher | 启动器 | |
| tab | 标签 | UI 标签页 |
| pane | 面板 | UI 面板 |
| split | 分屏 | UI 分割 |
| sidebar | 侧边栏 | |
| status indicator | 状态指示器 | |
| callout | 提示 | `<Callout>` 组件 |
| setup | 初始化 | repo setup |
| staging area | 暂存区 | git 概念 |
| merge | 合并 | git 概念 |
| rebase | 变基 | git 概念 |
| cherry-pick | 拣选 | git 概念 |
| stash | 储藏 | git 概念 |
| lockfile | 锁文件 | pnpm-lock.yaml |
| dependency | 依赖 | |
| build | 构建 | |
| deployment | 部署 | |
| emulator | 模拟器 | 移动设备 |
| computer use | 电脑操控 | 桌面自动化 |
| design mode | 设计模式 | 浏览器功能 |
| annotation | 注释 | AI diff 注释 |
| attribution | 归属 | diff 归属 |
| telemetry | 遥测 | |
| notifications | 通知 | |
| activity | 活动 | |
| troubleshooting | 故障排查 | |

## 命令与参数（不译）

`orca serve`, `orca open`, `orca status`, `orca worktree create`, `orca repo add`, `--json`, `--host`, `--environment`, `--prompt`, `--agent`, `--setup`, `--reference`, `orca_session_id`, `orca-ide`, etc.

## 代码块（不译）

所有编程语言代码、Shell 命令、配置文件内容、行内反引号 `` `...` `` 包裹的内容均不翻译。

## 链接（不翻译 URL，只翻译链接文本）

- `[安装](/docs/install)` → 只翻译 `安装`，URL `/docs/install` 保持
- `<a href="/docs/cli">CLI 文档</a>` → 只翻译可见文本
- `import { Callout } from '@/components/docs/prose'` → 路径不译
