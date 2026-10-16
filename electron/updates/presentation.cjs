const { tr } = require('../i18n.cjs');
function release(info) {
  const notes = Array.isArray(info.releaseNotes)
    ? info.releaseNotes.map(item => `${item.version ?? ''}\n${item.note ?? ''}`).join('\n\n')
    : String(info.releaseNotes ?? '');
  return {
    nextVersion: String(info.version),
    releaseName: String(info.releaseName ?? info.version),
    releaseDate: String(info.releaseDate ?? ''),
    releaseNotes: notes.slice(0, 16000),
  };
}

function updateError(error) {
  const message = String(error?.message ?? error);
  if (/404|ERR_UPDATER_LATEST_VERSION_NOT_FOUND|ERR_UPDATER_CHANNEL_FILE_NOT_FOUND/.test(message)) {
    return tr("发布源暂不可用，或尚未发布安装包与 latest.yml。请稍后重试，或打开发布页查看。");
  }
  if (/ERR_UPDATER_CHECKSUM_MISMATCH|sha512 checksum mismatch/i.test(message)) return tr("更新包校验失败，未安装。请重新下载。");
  if (/ERR_UPDATER_INVALID_SIGNATURE|signature/i.test(message)) return tr("更新包签名校验未通过，未安装。");
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|net::|ENETUNREACH/.test(message)) {
    return tr("无法连接更新服务，请检查网络后重试。");
  }
  if (/EACCES|EPERM|ENOSPC/.test(message)) return tr("无法写入更新文件，请检查磁盘空间和文件权限后重试。");
  return tr("更新操作未完成。请重试，或从发布页下载新版安装包。");
}

module.exports = { release, updateError };
