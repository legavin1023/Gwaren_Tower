// Uploaded paths are immutable. Reuse their blob URLs until removed or signed out.
export function createImageCache(load,revoke=url=>URL.revokeObjectURL(url)){
 const entries=new Map();let generation=0;
 return {
  async resolve(paths){
   const epoch=generation,wanted=new Set(paths.filter(Boolean));
   for(const [path,entry]of entries)if(!wanted.has(path)){entries.delete(path);if(entry.url)revoke(entry.url);}
   const results=await Promise.all([...wanted].map(async path=>{
    let entry=entries.get(path);
    if(!entry){entry={url:'',promise:null};entries.set(path,entry);entry.promise=Promise.resolve().then(()=>load(path)).then(url=>{if(epoch!==generation||entries.get(path)!==entry){if(url)revoke(url);return '';}entry.url=url;return url;}).catch(()=>{if(entries.get(path)===entry)entries.delete(path);return '';});}
    return [path,await entry.promise];
   }));
   return epoch===generation?Object.fromEntries(results):{};
  },
  clear(){generation++;for(const entry of entries.values())if(entry.url)revoke(entry.url);entries.clear();}
 };
}
