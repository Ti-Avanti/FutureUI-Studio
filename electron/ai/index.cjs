const { tr } = require('../i18n.cjs');
const path = require('node:path');
const settings=require('./settings.cjs'),skills=require('./skills.cjs'),agent=require('./agent.cjs'),protocol=require('./protocol.cjs'),conversations=require('./conversations.cjs');
function registerAI({app,window,dialog,safeStorage,register}){
  settings.init(app.getPath('userData'),safeStorage);conversations.init(app.getPath('userData'));skills.init(app.getPath('userData'),path.join(app.getAppPath(),'resources/skills'));
  register('ai:settings',settings.read);
  register('ai:conversations',conversations.read);
  register('ai:save-conversations',conversations.save);
  register('ai:save-settings',settings.save);
  register('ai:models',async()=>protocol.models(await settings.credentials()));
  register('ai:skills',skills.list);
  register('ai:enable-skill',skills.enable);
  register('ai:read-skill',(id,file)=>skills.readFile(id,file,true));
  register('ai:import-skill',async kind=>{
    const result=await dialog.showOpenDialog(window,{title:tr("添加或更新 Skill"),properties:[kind==='folder'?'openDirectory':'openFile'],...(kind==='folder'?{}:{filters:[{name:tr("Skill 包"),extensions:['zip','md']}]})});
    if(result.canceled)return null;
    return skills.install(result.filePaths[0]);
  });
  register('ai:start',input=>agent.run(input,event=>{if(!window.isDestroyed())window.webContents.send('ai:event',event);}));
  register('ai:cancel',agent.cancel);
  window.on('closed',agent.cancelAll);
}
module.exports={registerAI};
