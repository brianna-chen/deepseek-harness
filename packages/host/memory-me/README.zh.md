# @brianna-chen/dsh-host-memory-me

[English](README.md) | 中文

Memory ME 的 Host Remote 网关。它发现 Codex 与 Claude Code 的标准指令和 Skill 位置，预览内容、行变更、目标冲突与敏感信息提示，并且只执行用户明确确认的计划。

冲突策略包括跳过、Skill 安全改名、备份后替换，以及带可编辑内容的合并。每次成功写入都会执行验证、写入历史，并生成可执行回滚清单。服务还可把 Harness 指令与 Skills 导出为可移植 JSON。它不会扫描任意主目录树，也不读取聊天、Cookie、日志、凭据或平台数据库。浏览器输入限制为单文件 1 MiB、单次请求 5 MiB。

## 模型体验

无，因为该 Host 迁移服务不注册面向模型的提示或 schema；这些影响由独立工具包拥有。

#### KV Cache 影响

无。

## 已知限制与后续工作

- 目录选择识别 `AGENTS.md`、`CLAUDE.md` 和 `SKILL.md`，不会导入目录中的任意附件。
- 行变更用于辅助检查，不代表语义等价判断。
