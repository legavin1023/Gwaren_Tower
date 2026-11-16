export async function request(path,options={}) {
 const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{...(options.body instanceof Blob ? {} : {'Content-Type':'application/json'}),...options.headers}});
 if(!response.ok){let message;try{message=(await response.json()).error;}catch{message='서버 응답을 확인할 수 없습니다.';}throw new Error(message||'요청에 실패했습니다.');}
 return response.status===204?null:response.json();
}
export const save=(table,value)=>request('/'+table,{method:'POST',body:JSON.stringify(value)});
export const remove=(table,id)=>request('/'+table+'/'+id,{method:'DELETE'});
export const exportAll=()=>request('/export');
export async function imageBlob(path){if(!path)return '';const response=await fetch('/api/files/'+encodeURIComponent(path),{cache:'no-store'});if(!response.ok)throw new Error('이미지를 불러올 수 없습니다.');return URL.createObjectURL(await response.blob());}
export async function upload(file){if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>10485760)throw new Error('JPG·PNG·WebP·GIF, 10MB 이하 이미지를 선택하세요.');return (await request('/upload',{method:'POST',body:file,headers:{'Content-Type':file.type}})).path;}
