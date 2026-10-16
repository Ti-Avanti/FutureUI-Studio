import { englishMessage, tr } from '../i18n';

// Only editor-owned operation labels are translated; file paths and user content stay intact.
const keys = ['编辑 YAML', '创建文件', '移动组件', '复制组件', '删除组件', '添加 {0}', '应用 Agent 方案',
  '修改 {0}', '恢复默认 {0}', '保存前状态', '保存 {0} 个文件', '导入并合并 {0} 个配置', '回退至保存节点 {0}', '{0} 个文件'];
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = keys.flatMap(key => [...new Set([key, englishMessage(key)])].map(text => ({
  key, expression: new RegExp(`^${text.split(/\{\d+\}/).map(escape).join('(.+?)')}$`),
})));

export function historyLabel(value: string) {
  if (value.length > 1000) return value;
  for (const { key, expression } of patterns) {
    const match = value.match(expression);
    if (match) return tr(key, ...match.slice(1));
  }
  return value;
}
