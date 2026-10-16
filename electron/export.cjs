const fs = require('node:fs/promises');
const path = require('node:path');
const Zip = require('adm-zip');
const { getRoot, destination, verifyText } = require('./project.cjs');
const { within, limits } = require('./project-files.cjs');
const { randomUUID } = require('node:crypto');

async function writeExport(root, output, data) {
  const actual = path.join(await fs.realpath(path.dirname(output)), path.basename(output));
  if (within(root.toLowerCase(), actual.toLowerCase())) throw Error('请导出到工程以外的位置；更新当前工程请使用保存');
  const stat = await fs.lstat(actual).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw Error('导出目标不是普通文件');
  const temporary = `${actual}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, data, { flag: 'wx' }); await fs.rename(temporary, actual); }
  finally { await fs.unlink(temporary).catch(() => {}); }
  return output;
}

async function exportProject(id, files, output, includeAssets = true) {
  const root = getRoot(id), zip = new Zip();
  if (!Array.isArray(files) || !files.length || files.length > limits.count) throw Error('请选择需要导出的配置');
  if (new Set(files.map(f => f.path.toLowerCase())).size !== files.length) throw Error('导出列表存在重复路径');
  let bytes = 0;
  for (const file of files) { verifyText(file); bytes += Buffer.byteLength(file.text); if (bytes > limits.total) throw Error('导出配置超过 64 MB'); zip.addFile(file.path, Buffer.from(file.text, 'utf8')); }
  async function assets(dir, prefix) {
    for (const item of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (item.isSymbolicLink()) continue;
      const rel = `${prefix}/${item.name}`;
      if (item.isDirectory()) await assets(path.join(dir, item.name), rel);
      else if (/\.(png|vsh|fsh|glsl|json)$/i.test(item.name)) {
        const full = await destination(root, rel), size = (await fs.stat(full)).size;
        bytes += size;
        if (bytes > 256 * 1024 * 1024 || size > 64 * 1024 * 1024) throw Error('导出的资源超过大小限制（单文件 64 MB / 合计 256 MB）');
        zip.addFile(rel, await fs.readFile(full));
      }
    }
  }
  if (includeAssets) await assets(path.join(root, 'assets'), 'assets');
  return writeExport(root, output, zip.toBuffer());
}
async function exportFile(id, file, output) {
  verifyText(file);
  return writeExport(getRoot(id), output, Buffer.from(file.text, 'utf8'));
}
module.exports = { exportProject, exportFile };
