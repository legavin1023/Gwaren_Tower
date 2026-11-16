import {readFile} from 'node:fs/promises';import {verifyBackup,api,safeFile} from './backup-lib.mjs';
if(!process.env.BACKUP_DIR)throw Error('Set BACKUP_DIR to a downloaded complete backup folder.');const {snapshot,manifest}=await verifyBackup(process.env.BACKUP_DIR);
console.log('Verified snapshot and',manifest.files.length,'images.');if(!process.argv.includes('--apply')){console.log('Validation only. Use npm run restore -- --apply to restore.');process.exit(0);}
for(const f of manifest.files)await api('/backup/restore-file',process.env.RESTORE_TOKEN,{method:'POST',headers:{'Content-Type':f.mime,'X-Object-Key':f.path,'X-Sha256':f.sha256},body:await readFile(safeFile(process.env.BACKUP_DIR,f.file))});
await api('/backup/restore',process.env.RESTORE_TOKEN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});console.log('Restored DB transaction and verified private images. Existing sessions were revoked.');
