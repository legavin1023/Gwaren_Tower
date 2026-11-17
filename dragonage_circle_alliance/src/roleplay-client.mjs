import {ref, onBeforeUnmount} from 'vue';
import {request, imageBlob} from './api';
import {compressImage} from './image.mjs';

export async function uploadRoleplay(file, sceneId) {
 const compressed=await compressImage(file);
 return (await request('/roleplay/upload'+(sceneId?'?scene='+encodeURIComponent(sceneId):''),{method:'POST',body:compressed,headers:{'Content-Type':compressed.type}})).path;
}
export function useRoleplayFeed() {
 const scenes=ref([]),messages=ref([]),images=ref({}),reads=ref([]),error=ref(''),loading=ref(false);
 let cursor=0,task=null,again=false,disposed=false;
 const pendingImages=new Map();
 const allowedPaths=()=>new Set([...scenes.value.map(scene=>scene.image_path),...messages.value.filter(row=>!row.deleted_at).flatMap(row=>row.attachments)].filter(Boolean));
 async function ensureImages(paths) {
  await Promise.all([...new Set(paths)].filter(Boolean).filter(path=>!images.value[path]&&allowedPaths().has(path)).map(path=>{
   if(pendingImages.has(path))return pendingImages.get(path);
   const task=imageBlob(path).then(url=>{if(disposed||!allowedPaths().has(path))URL.revokeObjectURL(url);else images.value[path]=url;}).catch(()=>{}).finally(()=>pendingImages.delete(path));
   pendingImages.set(path,task);return task;
  }));
 }
 async function once() {
  const data=await request('/roleplay/sync?cursor='+cursor+'&scenes='+encodeURIComponent(scenes.value.map(scene=>scene.id).join(',')));if(disposed)return;
  const visible=new Set(data.scenes.map(scene=>scene.id));
  const records=new Map((data.reset?[]:messages.value).filter(row=>!row.scene_id||visible.has(row.scene_id)).map(row=>[row.id,row]));
  data.messages.forEach(row=>records.set(row.id,row));
  // Revoke cached private records before awaiting any newly invited scene history.
  scenes.value=data.scenes;messages.value=[...records.values()];
  const keep=new Set([...data.scenes.map(scene=>scene.image_path),...messages.value.filter(row=>!row.deleted_at).flatMap(row=>row.attachments)].filter(Boolean));
  for(const [path,url] of Object.entries(images.value))if(!keep.has(path)){URL.revokeObjectURL(url);delete images.value[path];}
  for(const sceneId of data.newly_visible||[]) {
   let after='';do{
    const history=await request('/roleplay/scenes/'+sceneId+'/history?after='+encodeURIComponent(after));
    if(disposed)return;history.messages.forEach(row=>records.set(row.id,row));after=history.next;
   }while(after);
  }
  scenes.value=data.scenes;messages.value=[...records.values()];reads.value=data.reads;cursor=data.cursor;
  if(data.has_more)again=true;
  const paths=new Set([...data.scenes.map(scene=>scene.image_path),...messages.value.filter(row=>!row.deleted_at).flatMap(row=>row.attachments)].filter(Boolean));
  for(const [path,url] of Object.entries(images.value))if(!paths.has(path)){URL.revokeObjectURL(url);delete images.value[path];}
 }
 function sync() {
  if(task){again=true;return task;}
  loading.value=true;error.value='';
  task=(async()=>{try{do{again=false;await once();}while(again&&!disposed);}catch(e){error.value=e.message;}finally{loading.value=false;task=null;}})();
  return task;
 }
 onBeforeUnmount(()=>{disposed=true;Object.values(images.value).forEach(url=>URL.revokeObjectURL(url));});
 return {scenes,messages,images,reads,error,loading,sync,ensureImages};
}
