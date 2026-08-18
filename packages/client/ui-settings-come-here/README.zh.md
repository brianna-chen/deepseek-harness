# @deepseek-ai/dsh-client-ui-settings-come-here

[English](README.md) | 中文

注册为 Web 设置区块的图形化 ComeHere 迁移向导。它依次提供导入声明、来源与内容勾选、完整预览、明确确认、进度展示和逐项完成报告。

## 模型体验

无，因为该向导仅存在于浏览器设置界面，不注册面向模型的内容。

#### KV Cache 影响

无。

## 已知限制与后续工作

- 浏览器上传目前接受单个 Markdown 文件，不接受目录压缩包。
- 导入进度按阶段展示；当前 Host 操作在一次 Remote 请求内完成。
