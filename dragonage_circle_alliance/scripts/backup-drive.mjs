import {loadConfig,configPath} from './prepare-drive-backup.mjs';
import path from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';import {verifyBackup,api} from './backup-lib.mjs';
const config=await loadConfig();if(!config.BACKUP_ROOT)throw Error('Backup folder missing in '+configPath);
const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(' ','_').replaceAll(':','');
process.env.SITE_URL=config.SITE_URL;process.env.BACKUP_TOKEN=config.BACKUP_TOKEN;process.env.BACKUP_DIR=path.join(config.BACKUP_ROOT,'circle-'+parts+'-'+Math.random().toString(16).slice(2,8));
await mkdir(process.env.BACKUP_DIR,{recursive:true});
try{
 await import('./backup.mjs');
 const {snapshot,manifest}=await verifyBackup(process.env.BACKUP_DIR);
 const summary={completed_at:new Date().toISOString(),tables:Object.fromEntries(Object.entries(snapshot.tables).map(([t,rows])=>[t,rows.length])),image_files:manifest.files.length,image_bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),verified:true};
 await writeFile(path.join(process.env.BACKUP_DIR,'verification.json'),JSON.stringify(summary,null,2));
 await api('/backup/status',config.BACKUP_TOKEN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'complete',details:{source:'drive-sync-folder',...summary}})});
 console.log(JSON.stringify(summary,null,2));
}catch(e){await writeFile(path.join(process.env.BACKUP_DIR,'FAILED.txt'),String(e.message));throw e;}
