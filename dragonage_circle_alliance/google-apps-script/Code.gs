/* Spreadsheet > Extensions > Apps Script. Configure Script Properties first.
SITE_URL, BACKUP_TOKEN, DRIVE_FOLDER_ID, SPREADSHEET_ID.
Never publish this script as a public web app. */
function settings_(){var p=PropertiesService.getScriptProperties();var c={url:p.getProperty('SITE_URL'),token:p.getProperty('BACKUP_TOKEN'),folder:p.getProperty('DRIVE_FOLDER_ID'),sheet:p.getProperty('SPREADSHEET_ID')};Object.keys(c).forEach(function(k){if(!c[k])throw new Error('Missing Script Property: '+k);});c.url=c.url.replace(/\/$/,'');return c;}
function fetch_(path){var p=PropertiesService.getScriptProperties();var c={url:(p.getProperty('SITE_URL')||'').replace(/\/$/,''),token:p.getProperty('BACKUP_TOKEN')};if(!c.url||!c.token)throw new Error('SITE_URL과 BACKUP_TOKEN을 설정하세요.');var r=UrlFetchApp.fetch(c.url+'/api'+path,{headers:{Authorization:'Bearer '+c.token},muteHttpExceptions:true});if(r.getResponseCode()!==200)throw new Error('Backup HTTP '+r.getResponseCode());return r;}
function hex_(bytes){return bytes.map(function(v){return ('0'+((v+256)%256).toString(16)).slice(-2);}).join('');}
function sha_(bytes){return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes));}
function log_(status,count,bytes,folder,message){var c=settings_();var ss=SpreadsheetApp.openById(c.sheet);var sheet=ss.getSheetByName('백업 기록')||ss.insertSheet('백업 기록');if(!sheet.getLastRow())sheet.appendRow(['실행 시각','상태','이미지 수','원본 바이트','Drive 폴더','내용']);sheet.appendRow([new Date(),status,count,bytes,folder,String(message||'').replace(/^[=+@-]/,"'")]);}
function notify_(status,detail){try{var c=settings_();UrlFetchApp.fetch(c.url+'/api/backup/status',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+c.token},payload:JSON.stringify({status:status,details:detail}),muteHttpExceptions:true});}catch(ignore){}}
function removeContinuation_(){ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='continueBackup')ScriptApp.deleteTrigger(t);});}
function installBackupTrigger(){settings_();ScriptApp.getProjectTriggers().forEach(function(t){if(t.getHandlerFunction()==='startBackup')ScriptApp.deleteTrigger(t);});ScriptApp.newTrigger('startBackup').timeBased().atHour(3).everyDays(1).inTimezone('Asia/Seoul').create();console.log('매일 한국 시간 오전 3~4시에 자동 백업합니다.');}
function setupBackup(){
 var props=PropertiesService.getScriptProperties();
 if(!props.getProperty('SITE_URL'))props.setProperty('SITE_URL','https://gwaren-tower.pages.dev');
 if(!props.getProperty('BACKUP_TOKEN'))throw new Error('프로젝트 설정 > 스크립트 속성에 BACKUP_TOKEN을 먼저 등록하세요.');
 // Verify source access before creating any folders or sheets.
 var probe=JSON.parse(fetch_('/backup/snapshot').getContentText());
 if(probe.format!=='circle-cloudflare-v1')throw new Error('사이트 백업 응답이 올바르지 않습니다.');
 if(!props.getProperty('DRIVE_FOLDER_ID'))props.setProperty('DRIVE_FOLDER_ID',DriveApp.createFolder('Gwaren Tower 사이트 백업').getId());
 var folder=DriveApp.getFolderById(props.getProperty('DRIVE_FOLDER_ID'));
 if(!props.getProperty('SPREADSHEET_ID')){var sheet=SpreadsheetApp.create('Gwaren Tower 백업 기록');DriveApp.getFileById(sheet.getId()).moveTo(folder);props.setProperty('SPREADSHEET_ID',sheet.getId());}
 installBackupTrigger();
 console.log('백업 폴더: '+folder.getUrl());
 console.log('기록 시트: https://docs.google.com/spreadsheets/d/'+props.getProperty('SPREADSHEET_ID'));
 startBackup();
}
function startBackup(){var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;try{
 var props=PropertiesService.getScriptProperties();if(props.getProperty('BACKUP_JOB')){ScriptApp.newTrigger('continueBackup').timeBased().after(60000).create();return;}
 var c=settings_();var snapshot=fetch_('/backup/snapshot').getContentText();var data=JSON.parse(snapshot);if(data.format!=='circle-cloudflare-v1')throw new Error('Invalid snapshot format');
 var folder=DriveApp.getFolderById(c.folder).createFolder('circle-'+Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd_HHmmss')+'-PARTIAL');
 var snapshotFile=folder.createFile('snapshot.json',snapshot,MimeType.PLAIN_TEXT);var manifestFile=folder.createFile('manifest.json',JSON.stringify({format:'circle-backup-files-v1',complete:false,snapshot_sha256:sha_(Utilities.newBlob(snapshot).getBytes()),files:[]}),MimeType.PLAIN_TEXT);
 props.setProperty('BACKUP_JOB',JSON.stringify({folder:folder.getId(),snapshot:snapshotFile.getId(),manifest:manifestFile.getId(),cursor:0,count:0,bytes:0}));
 }catch(e){log_('실패',0,0,'',e.message);notify_('failed',e.message);throw e;}finally{lock.releaseLock();}continueBackup();}
function continueBackup(){var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;var props=PropertiesService.getScriptProperties();var raw=props.getProperty('BACKUP_JOB');if(!raw){lock.releaseLock();return;}var job=JSON.parse(raw);try{
 removeContinuation_();var started=Date.now(),snapshot=JSON.parse(DriveApp.getFileById(job.snapshot).getBlob().getDataAsString()),manifestFile=DriveApp.getFileById(job.manifest),manifest=JSON.parse(manifestFile.getBlob().getDataAsString()),folder=DriveApp.getFolderById(job.folder),uploads=snapshot.tables.uploads;
 while(job.cursor<uploads.length&&Date.now()-started<220000){var u=uploads[job.cursor],filename=u.path.replace(/\//g,'__'),blob=fetch_('/backup/file/'+encodeURIComponent(u.path)).getBlob(),bytes=blob.getBytes();if(bytes.length!==u.bytes||sha_(bytes)!==u.sha256)throw new Error('Image integrity failure: '+u.path);
  var existing=folder.getFilesByName(filename);if(existing.hasNext()){var stored=existing.next();if(sha_(stored.getBlob().getBytes())!==u.sha256)throw new Error('Existing backup image differs');}else folder.createFile(blob.setName(filename));
  if(!manifest.files.some(function(f){return f.path===u.path;}))manifest.files.push({path:u.path,file:filename,sha256:u.sha256,bytes:u.bytes,mime:u.mime});
  job.cursor++;job.count=manifest.files.length;job.bytes=manifest.files.reduce(function(n,f){return n+f.bytes;},0);manifestFile.setContent(JSON.stringify(manifest));props.setProperty('BACKUP_JOB',JSON.stringify(job));
 }
 if(job.cursor<uploads.length){ScriptApp.newTrigger('continueBackup').timeBased().after(60000).create();return;}
 manifest.complete=true;manifest.completed_at=new Date().toISOString();manifestFile.setContent(JSON.stringify(manifest,null,2));folder.setName(folder.getName().replace('-PARTIAL',''));log_('성공',job.count,job.bytes,folder.getUrl(),'DB·이미지 SHA-256 검증 완료');notify_('complete',{count:job.count,bytes:job.bytes,folder:folder.getUrl()});props.deleteProperty('BACKUP_JOB');
 }catch(e){log_('실패·이어받기 가능',job.count,job.bytes,DriveApp.getFolderById(job.folder).getUrl(),e.message);notify_('failed',e.message);throw e;}finally{lock.releaseLock();}}
