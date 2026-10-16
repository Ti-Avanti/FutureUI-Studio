const { tr } = require('./i18n.cjs');
const path = require('node:path');
const project = require('./project.cjs');
const history = require('./project-history.cjs');
const { readImport } = require('./config-import.cjs');
const { exportProject, exportFile } = require('./export.cjs');

function registerConfigTools({ window, dialog, register }) {
  register('project:import-config', async kind => {
    if (!['files', 'folder'].includes(kind)) throw Error(tr("未知导入方式"));
    const chosen = await dialog.showOpenDialog(window, { title: kind === 'folder' ? tr("选择配置目录") : tr("导入 YAML 或 ZIP 配置"), properties: kind === 'folder' ? ['openDirectory'] : ['openFile', 'multiSelections'], ...(kind === 'folder' ? {} : { filters: [{ name: tr("配置文件"), extensions: ['yml', 'yaml', 'zip'] }] }) });
    return chosen.canceled ? null : readImport(chosen.filePaths, kind);
  });
  register('project:export-selection', async (id, files, format, assets) => {
    const root = project.getRoot(id);
    if (!Array.isArray(files) || !files.length) throw Error(tr("请选择导出的配置"));
    if (!['yaml', 'zip'].includes(format) || format === 'yaml' && files.length !== 1) throw Error(tr("单文件导出只能选择一个配置"));
    const chosen = await dialog.showSaveDialog(window, { title: tr("导出所选配置"), defaultPath: format === 'yaml' ? path.basename(files[0].path) : `${path.basename(root)}-configs.zip`, filters: [{ name: format === 'yaml' ? tr("YAML 配置") : tr("ZIP 配置包"), extensions: format === 'yaml' ? ['yml', 'yaml'] : ['zip'] }] });
    if (chosen.canceled) return null;
    return format === 'yaml' ? exportFile(id, files[0], chosen.filePath) : exportProject(id, files, chosen.filePath, assets === true);
  });
  register('project:history-list', id => history.list(project.getRoot(id)));
  register('project:history-read', (id, node) => history.read(project.getRoot(id), node));
}

module.exports = { registerConfigTools };
