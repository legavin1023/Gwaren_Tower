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
 ['댓글/댓글.json',t.comments],['관계·호감도/관계.json',t.relationships],
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

/* Daily category backup. Secret stays in Script Properties, never in code.
   setupBackup creates the folder, log sheet and the daily trigger. */
var BACKUP_LAYOUT_VERSION_='circle-categories-v1';
function settings_(){var p=PropertiesService.getScriptProperties();var c={url:p.getProperty('SITE_URL'),token:p.getProperty('BACKUP_TOKEN'),folder:p.getProperty('DRIVE_FOLDER_ID'),sheet:p.getProperty('SPREADSHEET_ID')};Object.keys(c).forEach(function(k){if(!c[k])throw new Error('Missing Script Property: '+k);});c.url=c.url.replace(/\/$/,'');return c;}
function fetch_(path){var p=PropertiesService.getScriptProperties();var c={url:(p.getProperty('SITE_URL')||'').replace(/\/$/,''),token:p.getProperty('BACKUP_TOKEN')};if(!c.url||!c.token)throw new Error('SITE_URL과 BACKUP_TOKEN을 설정하세요.');var r=UrlFetchApp.fetch(c.url+'/api'+path,{headers:{Authorization:'Bearer '+c.token},muteHttpExceptions:true});if(r.getResponseCode()!==200)throw new Error('Backup HTTP '+r.getResponseCode());return r;}
function hex_(bytes){return bytes.map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2);}).join('');}
function sha_(bytes){return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes));}
function log_(status,count,bytes,folder,message){var c=settings_(),ss=SpreadsheetApp.openById(c.sheet),sheet=ss.getSheetByName('백업 기록')||ss.insertSheet('백업 기록');if(!sheet.getLastRow())sheet.appendRow(['실행 시각','상태','이미지 수','원본 바이트','Drive 폴더','내용']);sheet.appendRow([new Date(),status,count,bytes,folder,String(message||'').replace(/^[=+@-]/,"'")]);}
function notify_(status,detail){try{var c=settings_();UrlFetchApp.fetch(c.url+'/api/backup/status',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+c.token},payload:JSON.stringify({status:status,details:detail}),muteHttpExceptions:true});}catch(ignore){}}
function childFolder_(parent,name){var it=parent.getFoldersByName(name);return it.hasNext()?it.next():parent.createFolder(name);}
function folderAt_(root,parts,create){var folder=root;parts.forEach(function(name){if(!name||name==='.'||name==='..')throw new Error('Unsafe backup path');if(create)folder=childFolder_(folder,name);else{var it=folder.getFoldersByName(name);if(!it.hasNext())throw new Error('Missing backup folder: '+name);folder=it.next();}});return folder;}
function fileAt_(root,path){var parts=path.split('/'),name=parts.pop(),it=folderAt_(root,parts,false).getFilesByName(name);if(!it.hasNext())return null;return it.next();}
function putJson_(root,path,text){var parts=path.split('/'),name=parts.pop(),parent=folderAt_(root,parts,true),it=parent.getFilesByName(name);if(it.hasNext()){var f=it.next();f.setContent(text);return f;}return parent.createFile(name,text,MimeType.PLAIN_TEXT);}
function readJson_(file){return JSON.parse(file.getBlob().getDataAsString());}
function managedBackup_(folder){try{var m=fileAt_(folder,'manifest.json'),s=fileAt_(folder,'snapshot.json');if(!m||!s)return false;var manifest=readJson_(m);return manifest.format==='circle-backup-files-v1' && manifest.complete===true && readJson_(s).format==='circle-cloudflare-v1' && sha_(s.getBlob().getBytes())===manifest.snapshot_sha256;}catch(e){return false;}}
function removeContinuation_(){ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='continueBackup')ScriptApp.deleteTrigger(t);});}
function continueLater_(){removeContinuation_();ScriptApp.newTrigger('continueBackup').timeBased().after(60000).create();}
function installBackupTrigger(){settings_();ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='startBackup')ScriptApp.deleteTrigger(t);});ScriptApp.newTrigger('startBackup').timeBased().atHour(3).everyDays(1).inTimezone('Asia/Seoul').create();console.log('매일 한국 시간 오전 3~4시에 자동 백업합니다.');}
function setupBackup(){
 var props=PropertiesService.getScriptProperties();if(!props.getProperty('SITE_URL'))props.setProperty('SITE_URL','https://gwaren-tower.pages.dev');
 if(!props.getProperty('BACKUP_TOKEN'))throw new Error('스크립트 속성에 BACKUP_TOKEN을 먼저 등록하세요.');
 if(JSON.parse(fetch_('/backup/snapshot').getContentText()).format!=='circle-cloudflare-v1')throw new Error('Invalid snapshot');
 if(!props.getProperty('DRIVE_FOLDER_ID'))props.setProperty('DRIVE_FOLDER_ID',DriveApp.createFolder('Gwaren Tower 사이트 백업').getId());
 var folder=DriveApp.getFolderById(props.getProperty('DRIVE_FOLDER_ID'));
 if(!props.getProperty('SPREADSHEET_ID')){var sheet=SpreadsheetApp.create('Gwaren Tower 백업 기록');DriveApp.getFileById(sheet.getId()).moveTo(folder);props.setProperty('SPREADSHEET_ID',sheet.getId());}
 installBackupTrigger();console.log('백업 폴더: '+folder.getUrl());console.log('기록 시트: https://docs.google.com/spreadsheets/d/'+props.getProperty('SPREADSHEET_ID'));startBackup();
}
function startBackup(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{
  var props=PropertiesService.getScriptProperties();if(props.getProperty('BACKUP_JOB')){continueLater_();return;}
  var c=settings_(),text=fetch_('/backup/snapshot').getContentText(),snapshot=JSON.parse(text);if(snapshot.format!=='circle-cloudflare-v1')throw new Error('Invalid snapshot format');
  var root=DriveApp.getFolderById(c.folder),stageRoot=childFolder_(root,'_진행중');
  var stamp=Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd_HHmmss'),day=stamp.slice(0,10),stage=stageRoot.createFolder('circle-'+stamp+'-PARTIAL');
  var snapshotFile=stage.createFile('snapshot.json',text,MimeType.PLAIN_TEXT),manifest={format:'circle-backup-files-v1',layout:BACKUP_LAYOUT_VERSION_,complete:false,snapshot_sha256:sha_(snapshotFile.getBlob().getBytes()),exports:[],files:[]};
  circleCategoryExports_(snapshot).forEach(function(entry){var file=putJson_(stage,entry.file,entry.body),bytes=file.getBlob().getBytes();manifest.exports.push({file:entry.file,sha256:sha_(bytes),bytes:bytes.length});});
  // Empty image categories are intentionally visible even before images are uploaded.
  folderAt_(stage,['이미지','캐릭터'],true);folderAt_(stage,['이미지','게시판'],true);folderAt_(stage,['이미지','기타'],true);
  var manifestFile=stage.createFile('manifest.json',JSON.stringify(manifest),MimeType.PLAIN_TEXT);
  props.setProperty('BACKUP_JOB',JSON.stringify({layout:BACKUP_LAYOUT_VERSION_,folder:stage.getId(),stageRoot:stageRoot.getId(),snapshot:snapshotFile.getId(),manifest:manifestFile.getId(),day:day,phase:'images',cursor:0,count:0,bytes:0}));
 }catch(e){log_('실패',0,0,'',e.message);notify_('failed',e.message);throw e;}finally{lock.releaseLock();}
 continueBackup();
}
function copyVerifiedFile_(source,destination,path,expected){
 var parts=path.split('/'),name=parts.pop(),parent=folderAt_(destination,parts,true),existing=parent.getFilesByName(name),file;
 if(existing.hasNext())file=existing.next();else file=fileAt_(source,path).makeCopy(name,parent);
 var bytes=file.getBlob().getBytes();if(bytes.length!==expected.bytes||sha_(bytes)!==expected.sha256)throw new Error('Copied backup integrity failure: '+path);return file;
}
function archiveStart_(job,source,manifest){
 var c=settings_(),history=childFolder_(DriveApp.getFolderById(c.folder),'최근 3일'),archive;
 if(job.archive)archive=DriveApp.getFolderById(job.archive);else{archive=history.createFolder(job.day+'-PARTIAL-'+job.folder);job.archive=archive.getId();}
 var text=DriveApp.getFileById(job.snapshot).getBlob().getDataAsString();putJson_(archive,'snapshot.json',text);
 manifest.exports.forEach(function(entry){copyVerifiedFile_(source,archive,entry.file,entry);});
 var archiveManifest={format:manifest.format,layout:manifest.layout,complete:false,snapshot_sha256:manifest.snapshot_sha256,exports:manifest.exports,files:[]};
 putJson_(archive,'manifest.json',JSON.stringify(archiveManifest));job.phase='archive';job.cursor=0;PropertiesService.getScriptProperties().setProperty('BACKUP_JOB',JSON.stringify(job));
}
function pruneHistory_(root,history,today,keepId){
 var cutoff=circleCutoffDay_(today),legacy=root.getFolders();
 while(legacy.hasNext()){var f=legacy.next();if(/^circle-\d{4}-\d{2}-\d{2}_\d{6}$/.test(f.getName())&&managedBackup_(f))f.moveTo(history);}
 var items=history.getFolders(),trash=[];
 while(items.hasNext()){var folder=items.next(),day=circleManagedDay_(folder.getName());if(folder.getId()===keepId||!day||!managedBackup_(folder))continue;
  // Replace duplicate daily snapshots; retain legacy copies until they are older than three days.
  if(day<cutoff||(day===today&&folder.getName()===today))trash.push(folder);
 }
 trash.forEach(function(folder){folder.setTrashed(true);});return trash.length;
}
function publishBackup_(job,source,manifest){
 var c=settings_(),props=PropertiesService.getScriptProperties(),root=DriveApp.getFolderById(c.folder),history=childFolder_(root,'최근 3일'),archive=DriveApp.getFolderById(job.archive);
 if(!managedBackup_(source)||!managedBackup_(archive))throw new Error('Refusing to publish incomplete backup');
 archive.setName(job.day);
 var oldId=props.getProperty('LATEST_FOLDER_ID'),old=null;
 if(oldId&&oldId!==source.getId()){old=DriveApp.getFolderById(oldId);if(!managedBackup_(old))throw new Error('Previous latest backup is not recognized');old.setName('replaced-'+oldId);old.moveTo(DriveApp.getFolderById(job.stageRoot));}
 source.setName('최신 백업');source.moveTo(root);props.setProperty('LATEST_FOLDER_ID',source.getId());
 var removed=pruneHistory_(root,history,job.day,archive.getId());if(old)old.setTrashed(true);
 log_('성공',job.count,job.bytes,source.getUrl(),'카테고리별 최신 백업 갱신 · 날짜별 최근 3일 보관 · 휴지통 이동 '+removed+'개');
 notify_('complete',{layout:BACKUP_LAYOUT_VERSION_,count:job.count,bytes:job.bytes,folder:source.getUrl(),daily:archive.getUrl(),retention_days:3,removed:removed});
 props.deleteProperty('BACKUP_JOB');removeContinuation_();console.log('최신 백업: '+source.getUrl());console.log('최근 3일: '+history.getUrl());
}
function continueBackup(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;var props=PropertiesService.getScriptProperties(),raw=props.getProperty('BACKUP_JOB');if(!raw){lock.releaseLock();return;}var job=JSON.parse(raw);
 try{
  if(job.layout!==BACKUP_LAYOUT_VERSION_)throw new Error('이전 형식의 진행 중 백업을 먼저 완료하거나 별도로 보관하세요.');
  removeContinuation_();var started=Date.now(),source=DriveApp.getFolderById(job.folder),snapshot=readJson_(DriveApp.getFileById(job.snapshot)),manifestFile=DriveApp.getFileById(job.manifest),manifest=readJson_(manifestFile),uploads=snapshot.tables.uploads;
  if(job.phase==='images'){
   while(job.cursor<uploads.length&&Date.now()-started<220000){var u=uploads[job.cursor],path=circleImageFile_(u,snapshot),parts=path.split('/'),name=parts.pop(),parent=folderAt_(source,parts,true),it=parent.getFilesByName(name),file;
    if(it.hasNext())file=it.next();else{var blob=fetch_('/backup/file/'+encodeURIComponent(u.path)).getBlob(),bytes=blob.getBytes();if(bytes.length!==u.bytes||sha_(bytes)!==u.sha256)throw new Error('Image integrity failure: '+u.path);file=parent.createFile(blob.setName(name));}
    var stored=file.getBlob().getBytes();if(stored.length!==u.bytes||sha_(stored)!==u.sha256)throw new Error('Stored image integrity failure');
    if(!manifest.files.some(function(f){return f.path===u.path;}))manifest.files.push({path:u.path,file:path,sha256:u.sha256,bytes:u.bytes,mime:u.mime});
    job.cursor++;job.count=manifest.files.length;job.bytes=manifest.files.reduce(function(n,f){return n+f.bytes;},0);manifestFile.setContent(JSON.stringify(manifest));props.setProperty('BACKUP_JOB',JSON.stringify(job));
   }
   if(job.cursor<uploads.length){continueLater_();return;}
   if(manifest.files.length!==uploads.length)throw new Error('Image manifest count mismatch');
   manifest.complete=true;manifest.completed_at=new Date().toISOString();manifestFile.setContent(JSON.stringify(manifest));archiveStart_(job,source,manifest);
  }
  if(job.phase==='archive'){
   var archive=DriveApp.getFolderById(job.archive),archiveFile=fileAt_(archive,'manifest.json'),archiveManifest=readJson_(archiveFile);
   while(job.cursor<manifest.files.length&&Date.now()-started<220000){var image=manifest.files[job.cursor];copyVerifiedFile_(source,archive,image.file,image);if(!archiveManifest.files.some(function(f){return f.path===image.path;}))archiveManifest.files.push(image);job.cursor++;archiveFile.setContent(JSON.stringify(archiveManifest));props.setProperty('BACKUP_JOB',JSON.stringify(job));}
   if(job.cursor<manifest.files.length){continueLater_();return;}
   if(archiveManifest.files.length!==uploads.length)throw new Error('Daily image count mismatch');
   archiveManifest.complete=true;archiveManifest.completed_at=manifest.completed_at;archiveFile.setContent(JSON.stringify(archiveManifest));publishBackup_(job,source,manifest);
  }
 }catch(e){log_('실패·이어받기 가능',job.count,job.bytes,DriveApp.getFolderById(job.folder).getUrl(),e.message);notify_('failed',e.message);throw e;}finally{lock.releaseLock();}
}
