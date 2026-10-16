import { tr } from '../i18n';
export const configFolders = ['menus', 'templates', 'languages', 'shops', 'functions', 'rules', 'hud', 'assets'];

export function configPathError(value: string): string {
  if (!value || /[\\\x00-\x1f:*?"<>|]/.test(value) || value.startsWith('/')) return tr("请使用工程内的相对路径和正斜杠");
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) return tr("路径含有不允许的名称");
  if (value !== 'config.yml' && !configFolders.includes(parts[0])) return tr("请选择 FutureUI 配置目录");
  return /\.ya?ml$/i.test(value) ? '' : tr("配置文件必须以 .yml 或 .yaml 结尾");
}
