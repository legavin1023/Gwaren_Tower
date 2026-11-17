export function notificationPath(value) {
 const path=String(value||'').replace(/^#/, '');
 return /^\/(?:board\/(?:story|art|notice)\/[\w-]+|characters\/[\w-]+)$/.test(path)?path:'';
}
