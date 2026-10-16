const fs = require('node:fs/promises');
const path = require('node:path');
const Zip = require('adm-zip');
const { getRoot, destination, verifyText } = require('./project.cjs');

async function exportProject(id, files, output) {
  const root = getRoot(id), zip = new Zip();
  for (const file of files) { verifyText(file); zip.addFile(file.path, Buffer.from(file.text, 'utf8')); }
  async function assets(dir, prefix) {
    for (const item of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (item.isSymbolicLink()) continue;
      const rel = `${prefix}/${item.name}`;
      if (item.isDirectory()) await assets(path.join(dir, item.name), rel);
      else if (/\.(png|vsh|fsh|glsl|json)$/i.test(item.name)) zip.addFile(rel, await fs.readFile(await destination(root, rel)));
    }
  }
  await assets(path.join(root, 'assets'), 'assets');
  await fs.writeFile(output, zip.toBuffer());
  return output;
}
module.exports = { exportProject };
