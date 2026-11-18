let requestMode='member';
export function accountRole(account){return account?.account_role||account?.role||'member';}
export function canUseAdminMode(account){return ['admin','superadmin'].includes(accountRole(account));}
export function accessModeKey(account){return 'circle-access-mode:'+encodeURIComponent(account.id);}
export function readAdminMode(account,storage){
 if(!canUseAdminMode(account))return false;
 try{return (storage||localStorage).getItem(accessModeKey(account))==='admin';}catch{return false;}
}
export function rememberAdminMode(account,enabled,storage){
 try{(storage||localStorage).setItem(accessModeKey(account),enabled&&canUseAdminMode(account)?'admin':'member');}catch{}
}
export function setRequestMode(mode){requestMode=mode==='admin'?'admin':'member';}
export function getRequestMode(){return requestMode;}
export function accessHeaders(){return {'X-Circle-Mode':requestMode};}
export function memberForMode(account,enabled){return account?{...account,role:enabled&&canUseAdminMode(account)?accountRole(account):'member'}:null;}
