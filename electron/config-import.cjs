const { tr } = require('./i18n.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Zip = require('adm-zip');
const { folders, limits, relative } = require('./project-files.cjs');

function suggestedPath(name) {
  const parts = name.replace(/\\/g, '/').split('/');
  if (parts.at(-1) === 'config.yml') return 'config.yml';
  const index = parts.findLastIndex(p => folders.has(p));
  const value = index < 0 ? null : parts.slice(index).join('/');
  if (value) relative(value);
  return value;
}

async function readImport(sources, kind) {
  const entries = [], warnings = [];
  let total = 0, ignored = 0, visited = 0;
  function append(name, data) {
    total += data.length;
    if (data.length > limits.file || total > limits.total || entries.length >= limits.count) throw Error(tr("导入超过上限（单文件 8 MB / 合计 64 MB / 4000 个文件）"));
    let text, error = '';
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { text = ''; error = tr("文件不是 UTF-8 编码，请转换后重新导入"); }
    if (data.subarray(0, 3).equals(Buffer.from([239, 187, 191]))) warnings.push(tr("{0} 的 UTF-8 BOM 已移除", path.basename(name)));
    entries.push({ id: randomUUID(), name: name.replace(/\\/g, '/').split('/').at(-1), path: suggestedPath(name), text, error });
  }
  async function readFile(file, name) {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error(tr("导入来源必须是普通文件"));
    if (stat.size > limits.file || total + stat.size > limits.total) throw Error(tr("导入文件超过大小限制"));
    append(name, await fs.readFile(file));
  }
  for (const source of sources) {
    if (kind === 'folder') {
      const root = await fs.realpath(source), base = path.basename(root);
      async function walk(dir, prefix, depth = 0) {
        if (depth > 24) throw Error(tr("导入目录层级超过 24 层"));
        for (const item of await fs.readdir(dir, { withFileTypes: true })) {
          if (++visited > 12000) throw Error(tr("目录文件过多，请选择更小的配置目录"));
          if (item.isSymbolicLink() || item.name.startsWith('.') || ['node_modules', 'build', 'target', 'data'].includes(item.name)) { ignored++; continue; }
          const full = path.join(dir, item.name), name = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.isDirectory()) await walk(full, name, depth + 1);
          else if (/\.ya?ml$/i.test(item.name)) await readFile(full, name);
          else ignored++;
        }
      }
      await walk(root, folders.has(base) ? base : '');
    } else if (/\.zip$/i.test(source)) {
      if ((await fs.stat(source)).size > limits.total) throw Error(tr("ZIP 文件超过 64 MB"));
      const zip = new Zip(await fs.readFile(source));
      const files = zip.getEntries();
      if (files.length > 12000) throw Error(tr("ZIP 内的文件数量过多"));
      for (const item of files) {
        const name = item.entryName.replace(/\\/g, '/');
        if (name.startsWith('/') || name.includes(':') || name.split('/').some(p => p === '..' || p === '.')) throw Error(tr("ZIP 包含不安全的相对路径"));
        if (((item.header.attr >>> 16) & 0xf000) === 0xa000) throw Error(tr("ZIP 不允许包含符号链接"));
        if (item.isDirectory) continue;
        if (!/\.ya?ml$/i.test(name) || name.split('/').some(p => p.startsWith('.'))) { ignored++; continue; }
        if (item.header.size > limits.file || total + item.header.size > limits.total) throw Error(tr("ZIP 解压后的配置超过大小限制"));
        append(name, item.getData());
      }
    } else {
      if (!/\.ya?ml$/i.test(source)) throw Error(tr("请选择 YAML 配置或 ZIP 配置包"));
      await readFile(source, source);
    }
  }
  if (!entries.length) throw Error(tr("没有找到可导入的 YAML 配置"));
  return { entries, ignored, warnings: warnings.slice(0, 20) };
}

module.exports = { readImport };
