const { tr } = require('./i18n.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { destination, verifyText, collectProject, hash } = require('./project-files.cjs');
const { saveProject } = require('./project-save.cjs');

const roots = new Map();
async function loadProject(input) {
  let root = await fs.realpath(input);
  if (await fs.stat(path.join(root, 'src/main/resources/menus')).catch(() => null)) root = await fs.realpath(path.join(root, 'src/main/resources'));
  if (!await fs.stat(path.join(root, 'menus')).catch(() => null)) throw Error(tr("请选择包含 menus 的 FutureUI 配置目录，或插件源码目录"));
  const { files, images } = await collectProject(root);
  const id = randomUUID(); roots.set(id, root);
  return { id, root, name: path.basename(root) === 'resources' ? path.basename(path.resolve(root, '../../..')) : path.basename(root), files, images };
}

function getRoot(id) { const root = roots.get(id); if (!root) throw Error(tr("工程已关闭，请重新打开")); return root; }
function saveFiles(id, files) { return saveProject(getRoot(id), files); }

async function importImage(id, source) {
  const root = getRoot(id), data = await fs.readFile(source);
  if (data.length > 8 * 1024 * 1024 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error(tr("请选择不超过 8 MB 的 PNG 图片"));
  const name = path.basename(source).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const rel = `assets/textures/studio/${hash(data).slice(0, 8)}-${name}`;
  await fs.writeFile(await destination(root, rel, true), data, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  return { path: rel, url: `data:image/png;base64,${data.toString('base64')}` };
}

module.exports = { loadProject, saveFiles, importImage, getRoot, destination, verifyText, hash };
