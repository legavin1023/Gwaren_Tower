import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';import os from 'node:os';
export const configPath=process.env.GWAREN_BACKUP_CONFIG||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.config'),'GwarenTower','backup.local.env');
export async function loadConfig(){const content=await readFile(configPath,'utf8');return Object.fromEntries(content.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));}
if(process.argv.includes('--prepare')){
 let config;try{config=await loadConfig();}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!config){config={SITE_URL:'https://gwaren-tower.pages.dev',BACKUP_TOKEN:randomBytes(48).toString('base64url'),BACKUP_ROOT:process.env.BACKUP_ROOT||path.resolve('..','..','..','사이트 백업','Gwaren Tower')};await mkdir(path.dirname(configPath),{recursive:true});await writeFile(configPath,Object.entries(config).map(([k,v])=>k+'='+v).join('\n')+'\n',{flag:'wx',mode:0o600});}
 if(!config.BACKUP_TOKEN)throw Error('Backup token missing');
 const wrangler=path.resolve('node_modules','wrangler','bin','wrangler.js');
 const result=spawnSync(process.execPath,[wrangler,'secret','put','BACKUP_TOKEN','--config','worker/wrangler.toml'],{input:config.BACKUP_TOKEN+'\n',encoding:'utf8',env:{...process.env,NODE_USE_SYSTEM_CA:'1'},windowsHide:true});
 if(result.status!==0){process.stderr.write(result.stderr||'Secret registration failed');process.exitCode=1;}else console.log('Read-only backup token registered. Private configuration:',configPath);
}
