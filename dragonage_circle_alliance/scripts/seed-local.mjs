import {fileURLToPath} from 'node:url';
import path from 'node:path';
export async function seedLocalServer(){
 const base='http://127.0.0.1:8787',origin='http://localhost:8090';
 const check=await fetch(base+'/api/me');
 if(check.headers.get('X-Circle-Local-Development')!=='1')throw new Error('로컬 개발 API가 아닙니다. 샘플을 추가하지 않았습니다.');
 const login=await fetch(base+'/api/auth/login',{redirect:'manual'});
 if(login.status!==302||login.headers.get('Location')!==origin+'/#/home')throw new Error('로컬 로그인에 실패했습니다.');
 const cookie=login.headers.get('Set-Cookie')?.split(';')[0];if(!cookie)throw new Error('로컬 세션을 확인하세요.');
 try {
  const response=await fetch(base+'/api/dev/seed',{method:'POST',headers:{Origin:origin,Cookie:cookie}});
  if(!response.ok)throw new Error('로컬 샘플 추가 실패: HTTP '+response.status);
  return await response.json();
 }finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie}});}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))seedLocalServer().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
