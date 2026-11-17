export const tables=['members','characters','affection','relationships','posts','comments','media','questions'];
export const fields={questions:['character_id','body','answer'],members:['email','nickname','role','active'],characters:['name','alias','faction','age','gender','race','origin','position','personality','background','goals','secrets','extra','image_path'],affection:['source_id','target_id','value','note'],relationships:['source_id','target_id','name','kind','description','directed','status'],posts:['character_id','category','title','body','character_ids'],comments:['character_id','target_id','post_id','parent_id','body'],media:['character_id','post_id','path','caption','bytes','mime']};
export function fail(message,status=400){throw new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
export const isAdmin=me=>['admin','superadmin'].includes(me?.role);
export function requireSuperAdmin(me){if(me?.role!=='superadmin')fail('최고 관리자 전용입니다.',403);}
export function requireAdmin(me){if(!isAdmin(me))fail('운영자 전용입니다.',403);}
export function canEdit(me,row){return isAdmin(me)||row?.owner_id===me.id;}
export function relationshipStatus(me,old,next,source,target){
 if(!source||!target||source.deleted_at||target.deleted_at||source.id===target.id)fail('서로 다른 활성 캐릭터를 선택하세요.');
 if(!old && source.owner_id!==me.id)fail('내 캐릭터로만 관계를 제안할 수 있습니다.',403);
 if(old && !isAdmin(me) && ![source.owner_id,target.owner_id].includes(me.id))fail('관계 당사자만 수정할 수 있습니다.',403);
 if(old && (old.source_id!==next.source_id||old.target_id!==next.target_id))fail('관계의 캐릭터는 변경할 수 없습니다.');
 if(source.owner_id===target.owner_id)return 'approved';
 if(!old)return 'pending';
 const edited=['name','kind','description','directed'].some(k=>old[k]!==next[k]);
 if(edited)return 'pending';
 if(next.status!==old.status && !isAdmin(me)){
  if(['approved','rejected'].includes(next.status)&&target.owner_id!==me.id)fail('상대 오너만 승인·거절할 수 있습니다.',403);
  if(next.status==='pending'&&source.owner_id!==me.id)fail('제안자만 다시 제안할 수 있습니다.',403);
 }
 return next.status;
}
export function validateImage(bytes,mime){
 const a=new Uint8Array(bytes);const text=(from,to)=>String.fromCharCode(...a.slice(from,to));
 const valid=mime==='image/png'?a.length>8&&a[0]===137&&text(1,4)==='PNG':mime==='image/jpeg'?a.length>3&&a[0]===255&&a[1]===216&&a[2]===255:mime==='image/gif'?['GIF87a','GIF89a'].includes(text(0,6)):mime==='image/webp'?text(0,4)==='RIFF'&&text(8,12)==='WEBP':false;
 if(!valid||a.length>10485760)fail('유효한 JPG·PNG·GIF·WebP 이미지(10MB 이하)가 필요합니다.');
}

// The highest tier is pinned to the server's bootstrap email, never granted via client role input.
export function memberView(env, row) {
 if(!row)return null;
 const isOwner=!!env.BOOTSTRAP_ADMIN_EMAIL && String(row.email||'').toLowerCase()===env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
 return {...row,role:isOwner?'superadmin':row.role};
}
export function memberChange(env, me, old, row) {
 requireAdmin(me);
 const ownerEmail=env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
 const owner=!!ownerEmail && row.email.toLowerCase()===ownerEmail;
 const oldRole=old?memberView(env,old).role:null;
 if(!['member','admin','superadmin'].includes(row.role))fail('올바른 회원 등급을 선택하세요.');
 if(me.role!=='superadmin' && (owner || (old && oldRole!=='member') || row.role!=='member'))fail('관리자 등급과 관리자 계정은 최고 관리자만 관리할 수 있습니다.',403);
 if(row.role==='superadmin'&&!owner)fail('최고 관리자는 최초 관리자 계정으로 고정됩니다.',403);
 if(owner && (!row.active || !['admin','superadmin'].includes(row.role)))fail('최고 관리자 계정의 권한과 접근은 해제할 수 없습니다.',403);
 if(old?.id===me.id && (!row.active || !['admin','superadmin'].includes(row.role)))fail('본인의 관리자 권한을 해제할 수 없습니다.',403);
 // SQLite keeps its existing member/admin constraint. The server derives the highest tier.
 row.role=owner?'admin':row.role;
 return row;
}
