export const zh = {
  nav: 'ComeHere', title: '迁移 AI 编程记忆', intro: '从 Codex、Claude Code 或浏览器文件安全导入规则、偏好与 Skills。',
  step1: '选择来源', step2: '扫描选择', step3: '处理冲突', step4: '确认导入', step5: '导入进度', step6: '完成报告', progress: '导入进度',
  declaration: '导入声明', declaration1: '只处理你勾选的 Markdown 指令和 Skills。', declaration2: '不会读取聊天记录、凭据、Cookie、Token、日志或平台数据库。', declaration3: '不会覆盖现有 Harness 文件；冲突项会跳过或改名。',
  source: '选择导入来源', codex: 'Codex', claude: 'Claude Code', global: '全局记忆', project: '项目记忆', projectPath: '远端项目绝对路径', upload: '从当前电脑选择 Markdown 文件',
  scan: '扫描可导入内容', scanning: '正在扫描…', select: '选择要导入的内容', selectHint: '系统已默认勾选发现的内容，你可以逐项排除。', empty: '没有发现可导入内容。', browserUpload: '浏览器上传', conflictBadge: '存在冲突',
  conflictTitle: '处理目标冲突', conflictHint: '为每个同名 Skill 选择跳过或安全改名。指令文件只允许跳过。', noConflicts: '没有目标冲突，可以继续确认导入。', skip: '跳过', rename: '安全改名', skipOnly: '只可跳过',
  confirmTitle: '确认导入计划', reviewSelected: '计划项目', reviewWrites: '将写入', reviewSkipped: '跳过/拒绝', confirm: '我已阅读声明并确认执行上述导入计划', import: '开始导入', importing: '正在逐项导入', complete: '导入完成',
  back: '上一步', next: '下一步', reset: '再次导入', imported: '成功', skipped: '跳过', rejected: '拒绝', failed: '失败', rollback: '查看回滚清单', error: '操作失败，请检查输入后重试。',
} as const
export type ComeHereLocaleKey = keyof typeof zh
export const en: Record<ComeHereLocaleKey, string> = {
  nav: 'ComeHere', title: 'Migrate AI coding memory', intro: 'Safely import instructions, preferences, and skills from Codex, Claude Code, or browser files.',
  step1: 'Choose source', step2: 'Scan & select', step3: 'Resolve conflicts', step4: 'Confirm', step5: 'Import progress', step6: 'Report', progress: 'Import progress',
  declaration: 'Import declaration', declaration1: 'Only selected Markdown instructions and skills are processed.', declaration2: 'Chats, credentials, cookies, tokens, logs, and platform databases are never read.', declaration3: 'Existing Harness files are never overwritten; conflicts are skipped or renamed.',
  source: 'Choose import sources', codex: 'Codex', claude: 'Claude Code', global: 'Global memory', project: 'Project memory', projectPath: 'Absolute remote project path', upload: 'Choose Markdown files from this computer',
  scan: 'Scan importable content', scanning: 'Scanning…', select: 'Select content to import', selectHint: 'Discovered content is selected by default. Exclude any item you do not want.', empty: 'No importable content was found.', browserUpload: 'Browser upload', conflictBadge: 'Conflict',
  conflictTitle: 'Resolve destination conflicts', conflictHint: 'Choose skip or safe rename for each conflicting skill. Instruction files can only be skipped.', noConflicts: 'No destination conflicts were found. Continue to confirmation.', skip: 'Skip', rename: 'Safe rename', skipOnly: 'Skip only',
  confirmTitle: 'Confirm import plan', reviewSelected: 'Plan items', reviewWrites: 'Writes', reviewSkipped: 'Skip/reject', confirm: 'I have read the declaration and confirm this import plan', import: 'Start import', importing: 'Importing items', complete: 'Import complete',
  back: 'Back', next: 'Continue', reset: 'Import again', imported: 'Imported', skipped: 'Skipped', rejected: 'Rejected', failed: 'Failed', rollback: 'View rollback manifests', error: 'The operation failed. Check the inputs and retry.',
}
