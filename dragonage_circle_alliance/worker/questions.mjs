import {fail} from './policy.mjs';
export function questionRecord(me,old,row,character,restore=false){
 if(old&&old.character_id!==row.character_id)fail('질문 대상은 변경할 수 없습니다.');
 if(typeof row.body!=='string'||!row.body.trim()||row.body.length>2000)fail('질문은 1~2000자로 입력하세요.');
 if(row.answer!==undefined&&(typeof row.answer!=='string'||row.answer.length>20000))fail('답변은 20000자 이내로 입력하세요.');
 if(restore){row.owner_id=old.owner_id;return row;}
 if(!old){
  if(character.owner_id===me.id)fail('다른 오너의 캐릭터에게 질문을 남겨 주세요.');
  if(row.answer)fail('질문을 남길 때 답변을 작성할 수 없습니다.',403);
  return {...row,owner_id:me.id,answer:'',answered_by:null,answered_at:null};
 }
 row.owner_id=old.owner_id;
 if(me.id===character.owner_id){
  if(row.body!==old.body)fail('다른 오너의 질문 내용은 수정할 수 없습니다.',403);
  if(!row.answer?.trim())fail('답변 내용을 입력하세요.');
  row.answered_by=me.id;row.answered_at=new Date().toISOString();return row;
 }
 if(me.id!==old.owner_id)fail('질문자 또는 캐릭터 오너만 수정할 수 있습니다.',403);
 if(row.answer!==old.answer)fail('캐릭터 오너만 답변할 수 있습니다.',403);
 if(old.answer)fail('답변이 등록된 질문은 수정할 수 없습니다.',403);
 return row;
}
