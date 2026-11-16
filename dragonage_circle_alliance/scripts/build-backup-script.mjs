import {readFile,writeFile} from 'node:fs/promises';
const shared=await readFile(new URL('./backup-layout.cjs',import.meta.url),'utf8');
const core=await readFile(new URL('../google-apps-script/BackupCore.gs',import.meta.url),'utf8');
await writeFile(new URL('../google-apps-script/Code.gs',import.meta.url),shared+'\n'+core);
console.log('Built standalone Google Apps Script backup source.');
