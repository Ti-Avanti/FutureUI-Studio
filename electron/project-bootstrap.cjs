const fs = require('node:fs/promises');
const path = require('node:path');
const { tr } = require('./i18n.cjs');
const project = require('./project.cjs');
const { collectProject } = require('./project-files.cjs');

const defaultName = 'FutureUI-工作工程';
const stat = file => fs.lstat(file).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });

function createProjectBootstrap(app) {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  // fs.cp cannot traverse ASAR directories. Installed examples are real resources beside app.asar.
  const examplePath = app.isPackaged
    ? path.join(process.resourcesPath, 'example')
    : path.join(app.getAppPath(), 'resources', 'example');

  async function remember(value) {
    await fs.writeFile(settingsPath, JSON.stringify({ lastProject: value.root }), 'utf8');
    return value;
  }

  async function create(parent, name = defaultName) {
    const base = await fs.realpath(parent), target = path.join(base, name);
    if (await stat(target)) throw Error(tr('该目录已存在 FutureUI-工作工程，请选择其他位置'));
    if (!(await stat(path.join(examplePath, 'menus')))?.isDirectory() || !(await stat(path.join(examplePath, 'config.yml')))?.isFile()) {
      throw Error(tr('内置示例工程不完整，请重新安装最新版 FutureUI Studio。'));
    }
    const staging = await fs.mkdtemp(path.join(base, '.futureui-create-'));
    if (path.dirname(staging) !== base) throw Error(tr('路径超出工程范围'));
    const copied = path.join(staging, 'project');
    try {
      await fs.cp(examplePath, copied, { recursive: true, errorOnExist: true, force: false });
      await collectProject(copied);
      if (await stat(target)) throw Error(tr('该目录已存在 FutureUI-工作工程，请选择其他位置'));
      await fs.rename(copied, target);
      return await remember(await project.loadProject(target));
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  async function restore(explicit) {
    if (explicit) return remember(await project.loadProject(explicit));
    const saved = await fs.readFile(settingsPath, 'utf8').then(JSON.parse).catch(() => ({}));
    if (saved.lastProject) { try { return await project.loadProject(saved.lastProject); } catch {} }
    const parent = path.join(app.getPath('userData'), 'Projects');
    await fs.mkdir(parent, { recursive: true });
    const existing = path.join(parent, defaultName);
    if (await stat(existing)) { try { return await remember(await project.loadProject(existing)); } catch {} }
    // An older failed creation may have left an empty/partial directory. Keep it intact.
    const names = new Set(await fs.readdir(parent));
    let name = defaultName;
    for (let index = 2; names.has(name); index++) name = `${defaultName}-${index}`;
    return create(parent, name);
  }

  return { restore, create, remember };
}

module.exports = { createProjectBootstrap };
