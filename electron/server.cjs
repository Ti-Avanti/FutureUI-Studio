const { Rcon } = require('rcon-client');
async function command(settings, operation, player, menu) {
  if (!settings || typeof settings.host !== 'string' || settings.host.length > 253 || /[\s/\\]/.test(settings.host)) throw Error('请输入有效的 RCON 主机地址');
  const port = Number(settings.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || typeof settings.password !== 'string' || !settings.password) throw Error('请输入 RCON 端口和密码');
  const actions = { status: 'fui status', validate: 'fui validate', reload: 'fui reload', pack: 'fui pack' };
  let text = actions[operation];
  if (operation === 'open') {
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(player ?? '') || !/^[a-zA-Z0-9_/-]{1,128}$/.test(menu ?? '')) throw Error('玩家名称或菜单 ID 无效');
    text = `fui openfor ${player} ${menu}`;
  }
  if (!text) throw Error('不支持的服务器操作');
  let client;
  try { client = await Rcon.connect({ host: settings.host, port, password: settings.password, timeout: 8000 }); return await client.send(text); }
  catch (e) { throw Error(String(e.message).replaceAll(settings.password, '••••')); }
  finally { if (client) await client.end().catch(() => {}); }
}
module.exports = { command };
