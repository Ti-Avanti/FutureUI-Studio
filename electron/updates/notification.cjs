const { Notification } = require('electron');
const path = require('node:path');

function updateNotifications(app, window) {
  let notifiedVersion = '', notification;
  return {
    available(version) {
      if (version === notifiedVersion || window.isDestroyed()) return;
      notifiedVersion = version;
      if (window.isFocused() || !Notification.isSupported()) return;
      try {
        notification?.close();
        notification = new Notification({
          title: 'FutureUI Studio 有新版本',
          body: `版本 ${version} 已发布，点击查看更新内容。由你决定何时下载和安装。`,
          icon: path.join(app.getAppPath(), 'resources/branding/icon.png'),
        });
        notification.on('click', () => {
          if (window.isDestroyed()) return;
          if (window.isMinimized()) window.restore();
          window.show(); window.focus();
          window.webContents.send('updates:open');
        });
        notification.show();
      } catch { /* 系统禁用通知时，窗口中的更新提醒仍然可用。 */ }
    },
    dispose() { notification?.close(); },
  };
}

module.exports = { updateNotifications };
