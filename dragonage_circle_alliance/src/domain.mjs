import {themeColor} from './character-theme.mjs';
export function graphElements(characters, relationships, faction='', type='') {
 const visible=characters.filter(c=>!c.deleted_at && (!faction || c.faction===faction));
 const ids=new Set(visible.map(c=>c.id));
 return [
 ...visible.map(c=>({data:{id:c.id,label:c.name,faction:c.faction,image:c.image||'',themeColor:themeColor(c)}})),
 ...relationships.filter(r=>!r.deleted_at && r.status==='approved' && ids.has(r.source_id) && ids.has(r.target_id) && (!type || r.kind===type)).map(r=>({data:{id:'r-'+r.id,source:r.source_id,target:r.target_id,label:r.name,directed:r.directed,description:r.description}}))
 ];
}
export function mentionParts(text,characters) {
 const byId=new Map(characters.map(c=>[c.id,c]));
 return String(text||'').split(/(@\[[^\]]+\]\([0-9a-f-]{36}\))/gi).filter(Boolean).map(part=>{
 const match=part.match(/^@\[([^\]]+)\]\(([0-9a-f-]{36})\)$/i);
 return match && byId.has(match[2]) ? {text:byId.get(match[2]).name,id:match[2]} : {text:part};
 });
}

// Explicit character authors keep their identity. Owner comments use the owner's current representative.
export function commentCharacter(comment, characters, members) {
 const owner=members.find(member=>member.id===comment.owner_id);
 const characterId=comment.character_id || owner?.representative_character_id;
 return characters.find(character=>character.id===characterId && !character.deleted_at && character.owner_id===comment.owner_id) || null;
}
