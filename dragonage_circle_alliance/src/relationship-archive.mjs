import {mentionParts} from './domain.mjs';
export function relationshipArchive(id,characters,relationships,posts){
 const live=characters.filter(character=>!character.deleted_at),byId=new Map(live.map(character=>[character.id,character]));
 const relation=relationships.find(row=>row.id===id&&row.status==='approved'&&!row.deleted_at);
 if(!relation||!byId.has(relation.source_id)||!byId.has(relation.target_id))return null;
 const source=byId.get(relation.source_id),target=byId.get(relation.target_id),pair=new Set([source.id,target.id]);
 const settings=relationships.filter(row=>!row.deleted_at&&row.status==='approved'&&pair.has(row.source_id)&&pair.has(row.target_id));
 const shared=posts.filter(post=>!post.deleted_at&&['story','art'].includes(post.category)).filter(post=>{
  const ids=new Set([post.character_id,...(post.character_ids||[]),...mentionParts(post.body,live).map(part=>part.id).filter(Boolean)]);
  return ids.has(source.id)&&ids.has(target.id);
 });
 return {source,target,settings,stories:shared.filter(post=>post.category==='story').slice().reverse(),logs:shared.filter(post=>post.category==='art')};
}
