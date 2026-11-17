// Shared, pure backup layout helpers. This file is also included in Code.gs.
function circleSafeName_(value) {
 return String(value || '이름 없음').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/^\.+/,'_').trim().slice(0,70) || '이름 없음';
}
function circleCategoryExports_(snapshot) {
 var t=snapshot.tables,posts=t.posts || [];
 var entries=[
 ['회원/회원.json',t.members],['캐릭터/캐릭터.json',t.characters],
 ['게시판/공지.json',posts.filter(function(p){return p.category==='notice';})],
 ['게시판/썰.json',posts.filter(function(p){return p.category==='story';})],
 ['게시판/그림·로그.json',posts.filter(function(p){return p.category==='art';})],
 ['댓글/댓글.json',t.comments],['캐릭터/질문과 답변.json',t.questions || []],['관계·호감도/관계.json',t.relationships],
 ['관계·호감도/호감도.json',t.affection],['이미지/이미지정보.json',t.media],
 ['이미지/원본목록.json',t.uploads],['운영 기록/수정·삭제이력.json',t.history],
 ['운영 기록/백업실행기록.json',t.backup_runs || []]
 ];
 return entries.map(function(entry){return {file:entry[0],body:JSON.stringify(entry[1] || [],null,2)};});
}
function circleImageFile_(upload,snapshot) {
 var t=snapshot.tables,media=(t.media || []).filter(function(m){return m.path===upload.path;});
 var c=(t.characters || []).find(function(c){return c.image_path===upload.path;});
 if(!c && media.length && media[0].character_id)c=(t.characters || []).find(function(c){return c.id===media[0].character_id;});
 var filename=upload.path.replace(/\//g,'__');
 if(c)return '이미지/캐릭터/'+circleSafeName_(c.name)+'__'+c.id+'/'+filename;
 var postId=media.length?media[0].post_id:null;
 var p=(t.posts || []).find(function(p){return p.id===postId;});
 if(p){var category={notice:'공지',story:'썰',art:'그림·로그'}[p.category] || '기타';return '이미지/게시판/'+category+'/'+circleSafeName_(p.title)+'__'+p.id+'/'+filename;}
 return '이미지/기타/'+filename;
}
function circleManagedDay_(name) {
 var match=String(name).match(/^(?:circle-)?(\d{4}-\d{2}-\d{2})(?:_\d{6})?$/);
 return match?match[1]:null;
}
function circleCutoffDay_(today) {
 var date=new Date(today+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-2);return date.toISOString().slice(0,10);
}
if(typeof module!=='undefined')module.exports={categoryExports:circleCategoryExports_,imageFile:circleImageFile_,managedDay:circleManagedDay_,cutoffDay:circleCutoffDay_};
