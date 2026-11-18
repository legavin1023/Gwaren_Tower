import {mentionParts} from './domain.mjs';

export function roleplayPlainText(text,characters=[],limit=120) {
 const normalized=String(text||'').replace(/\\([\[\]()])/g,'$1');
 const plain=mentionParts(normalized,characters).map(part=>part.id?'@'+part.text:part.text).join('')
  .replace(/\*\*|\*|^>\s?/gm,'').replace(/\s+/g,' ').trim();
 const letters=Array.from(plain);
 return letters.length>limit?letters.slice(0,limit).join('')+'…':plain;
}
export function roleplayDraftKey(memberId,context,actor) {
 return ['circle-roleplay',memberId,context,actor||'owner'].map(encodeURIComponent).join(':');
}
export function inlineRoleplay(text) {
 return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).filter(Boolean).map(part=>
  part.startsWith('**')&&part.endsWith('**')?{kind:'strong',text:part.slice(2,-2)}:
  part.startsWith('*')&&part.endsWith('*')?{kind:'em',text:part.slice(1,-1)}:{kind:'text',text:part});
}
export function roleplayRecords(scenes,messages,characterIds=[],characters=[]) {
 const active=messages.filter(row=>!row.deleted_at),records=[];
 for(const scene of scenes) {
  const rows=active.filter(row=>row.scene_id===scene.id);
  const ids=[...new Set([...scene.participant_ids,...rows.map(row=>row.character_id)].filter(Boolean))];
  if(characterIds.every(id=>ids.includes(id)))records.push({id:scene.id,type:'scene',title:scene.title,url:'/roleplay/scene/'+scene.id,status:scene.status,character_ids:ids,rows,updated_at:rows.reduce((at,row)=>row.updated_at>at?row.updated_at:at,scene.updated_at)});
 }
 const roots=[...new Set(active.filter(row=>!row.scene_id).map(row=>row.thread_id))];
 for(const id of roots) {
  const rows=active.filter(row=>!row.scene_id&&row.thread_id===id),root=messages.find(row=>row.id===id);
  const ids=[...new Set(rows.map(row=>row.character_id).filter(Boolean))];
  if(characterIds.every(id=>ids.includes(id)))records.push({id,type:'timeline',title:root?.deleted_at?'삭제된 원글의 대화':roleplayPlainText(root?.body,characters,100)||'이미지 역극',url:'/roleplay/thread/'+id,status:'active',character_ids:ids,rows,updated_at:rows.reduce((at,row)=>row.updated_at>at?row.updated_at:at,root?.created_at||'')});
 }
 return records.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
}
