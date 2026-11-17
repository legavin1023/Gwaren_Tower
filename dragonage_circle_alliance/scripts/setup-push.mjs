import {generateKeyPairSync} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
const folder=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.config'),'GwarenTower');
const file=path.join(folder,'push-vapid.local.json');
let keys;
try{keys=JSON.parse(await readFile(file,'utf8'));}catch(error){
 if(error.code!=='ENOENT')throw error;
 const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=privateKey.export({format:'jwk'});
 keys={PUSH_VAPID_PUBLIC_KEY:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url'),PUSH_VAPID_PRIVATE_KEY:jwk.d};
 await mkdir(folder,{recursive:true});await writeFile(file,JSON.stringify(keys),{flag:'wx',mode:0o600});
}
if(process.argv.includes('--apply')){
 for(const name of ['PUSH_VAPID_PUBLIC_KEY','PUSH_VAPID_PRIVATE_KEY']){
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put',name,'--config','worker/wrangler.toml'],{input:keys[name]+'\n',encoding:'utf8',env:{...process.env,NODE_USE_SYSTEM_CA:'1'}});
  if(result.status!==0){throw new Error('푸시 서버 키 등록 실패: '+name+' (Wrangler 로그인 상태를 확인하세요.)');}
 }
 console.log('푸시 서버 키를 Worker Secrets에 등록했습니다.');
}else console.log('푸시 서버 키 준비 완료. --apply 옵션을 주면 Worker Secrets에 등록합니다.');
console.log('비공개 키 보관 위치: '+file);
