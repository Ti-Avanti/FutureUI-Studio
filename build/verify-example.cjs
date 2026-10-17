const fs = require('node:fs/promises');
const path = require('node:path');

// Validate the actual distributable, not just the source folder, before producing installers.
module.exports = async context => {
  const source = path.join(context.packager.projectDir, 'resources', 'example');
  const bundled = path.join(context.packager.getResourcesDir(context.appOutDir), 'example');
  let files = 0;
  async function compare(relative = '') {
    for (const entry of await fs.readdir(path.join(source, relative), { withFileTypes: true })) {
      const item = path.join(relative, entry.name);
      if (entry.isDirectory()) await compare(item);
      else if (entry.isFile()) {
        const [expected, actual] = await Promise.all([fs.readFile(path.join(source, item)), fs.readFile(path.join(bundled, item))]);
        if (!expected.equals(actual)) throw Error(`Bundled example differs from source: ${item}`);
        files++;
      } else throw Error(`Unsupported bundled example entry: ${item}`);
    }
  }
  await compare();
  if (!files || !(await fs.stat(path.join(bundled, 'menus'))).isDirectory()) throw Error('Bundled example has no menus');
  await fs.access(path.join(bundled, 'config.yml'));
  console.log(`Verified ${files} example files outside app.asar`);
};
