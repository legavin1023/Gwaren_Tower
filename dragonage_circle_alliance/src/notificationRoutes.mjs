export function notificationPath(value) {
 const path=String(value||'').replace(/^#/, '');
 return /^\/(?:board\/(?:story|art|notice)\/[\w-]+|characters\/[\w-]+|roleplay\/(?:scene|thread)\/[\w-]+)$/.test(path)?path:'';
}
