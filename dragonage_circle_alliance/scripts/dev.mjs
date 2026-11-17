import {spawn,spawnSync} from 'node:child_process';
import {createConnection} from 'node:net';
import {fileURLToPath} from 'node:url';
import {seedLocalServer} from './seed-local.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const env={...process.env,NODE_USE_SYSTEM_CA:'1',WRANGLER_SEND_METRICS:'false'};
const config='worker/wrangler.dev.toml',persist='.wrangler/local-development';
const wrangler='node_modules/wrangler/bin/wrangler.js';
async function checkPort(port){
 for(const host of ['127.0.0.1','::1'])await new Promise((resolve,reject)=>{
  const socket=createConnection({port,host});
  socket.once('connect',()=>{socket.destroy();reject(new Error(`${port} 포트가 사용 중입니다. 기존 개발 서버를 Ctrl+C로 종료한 뒤 다시 실행하세요.`));});
  socket.once('error',()=>{socket.destroy();resolve();});
  socket.setTimeout(1000,()=>{socket.destroy();resolve();});
 });
}
try{await checkPort(8090);await checkPort(8787);}catch(error){console.error(error.message);process.exit(1);}
const migration=spawnSync(process.execPath,[wrangler,'d1','migrations','apply','circle-alliance-local','--local','--config',config,'--persist-to',persist],{stdio:'inherit',env,windowsHide:true});
if(migration.status!==0){console.error('로컬 DB 초기화에 실패했습니다. 운영 DB에는 변경이 없습니다.');process.exit(migration.status||1);}
const children=[];let closing=false;
function shutdown(code=0){if(closing)return;closing=true;
 for(const child of children)if(child.pid&&child.exitCode===null){
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
  else child.kill('SIGTERM');
 }
 process.exit(code);
}
for(const args of [
 [wrangler,'dev','--local','--config',config,'--persist-to',persist,'--ip','127.0.0.1','--port','8787'],
 ['node_modules/@vue/cli-service/bin/vue-cli-service.js','serve','--host','127.0.0.1','--port','8090']
]){
 const child=spawn(process.execPath,args,{stdio:'inherit',env,windowsHide:true});children.push(child);
 child.on('error',()=>shutdown(1));child.on('exit',code=>{if(!closing)shutdown(code||1);});
}
console.log('로컬 개발 주소: http://localhost:8090 — 로컬 개발 모드로 입장 버튼을 누르세요.');
console.log('종료: Ctrl+C (화면 서버와 API가 함께 종료됩니다.)');
process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());
if(!process.stdin.isTTY){process.stdin.resume();process.stdin.on('data',data=>{if(data.includes(3))shutdown();});}

async function prepareDemo(){
 for(let attempt=0;attempt<40;attempt++){
  try{const response=await fetch('http://127.0.0.1:8787/api/me');if(response.headers.get('X-Circle-Local-Development')==='1'){const result=await seedLocalServer();console.log(result.seeded?'로컬 디자인 샘플을 추가했습니다.':result.message);return;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 console.error('샘플 자동 준비를 완료하지 못했습니다. API가 준비된 후 npm run dev:seed를 실행하세요.');
}
prepareDemo();
