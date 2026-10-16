const updates = require('./resources/updates.json');
const notes = require('./resources/release-notes.json');
const pkg = require('./package.json');

if (notes.version !== pkg.version) throw Error('发布说明版本与 package.json 不一致');

module.exports = {
  appId: 'gg.fotia.futureui.studio',
  productName: 'FutureUI Studio',
  directories: { output: 'release', buildResources: 'build' },
  files: ['dist/**/*', 'electron/**/*', 'resources/**/*', 'package.json', '!**/__pycache__/**', '!**/*.pyc'],
  asar: true,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }, { target: 'portable', arch: ['x64'] }],
    icon: 'build/icon.ico',
    signExecutable: false,
  },
  nsis: {
    artifactName: 'FutureUI-Studio-Setup-${version}.${ext}',
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
    differentialPackage: true,
    runAfterFinish: true,
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    include: 'build/installer.nsh',
  },
  portable: { artifactName: 'FutureUI-Studio-${version}-Portable.${ext}' },
  publish: { provider: 'github', owner: updates.owner, repo: updates.repo, releaseType: 'release' },
  releaseInfo: {
    releaseName: notes.title,
    releaseNotes: `## 简体中文\n${notes.changes.map(change => `- ${change}`).join('\n')}\n\n## English\n${(notes.changesEn ?? notes.changes).map(change => `- ${change}`).join('\n')}`,
  },
};
