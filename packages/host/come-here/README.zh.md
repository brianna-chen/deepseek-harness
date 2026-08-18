# @deepseek-ai/dsh-host-come-here

[English](README.md) | 中文

ComeHere 设置向导的 Host Remote 网关。它发现 Codex 与 Claude Code 的标准指令和 Skill 位置，返回不写入的预览，并仅在用户明确确认后执行只创建导入。

网关不会扫描任意主目录树、读取平台数据库或覆盖 Harness 文件。浏览器上传限制为单文件 1 MiB、单次请求 5 MiB；疑似密钥内容会在写入前被拒绝。导入成功后会生成包含全部新增路径的回滚清单。

## 模型体验

无，因为该 Host 迁移服务不注册面向模型的提示或 schema；这些影响由独立工具包拥有。

#### KV Cache 影响

无。

## 已知限制与后续工作

- 浏览器上传目前接受单个 Markdown 文件，不接受目录压缩包。
- 回滚以清单形式报告，界面暂不直接执行回滚。
- 已存在的指令会跳过，不做语义合并。
