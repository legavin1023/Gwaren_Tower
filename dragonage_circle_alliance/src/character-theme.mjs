export function themeColor(character) {
 const value=character?.extra?.theme_color;
 return typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
}
const channels=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
const hex=rgb=>'#'+rgb.map(value=>Math.round(value).toString(16).padStart(2,'0')).join('');
function luminance(color){return channels(color).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function readableColor(color,background,dark=false){
 const rgb=channels(color),end=dark?255:0;
 for(let step=0;step<=100;step++){const candidate=hex(rgb.map(value=>value+(end-value)*step/100));if(contrast(candidate,background)>=4.5)return candidate;}
 return dark?'#ffffff':'#000000';
}
export function characterTheme(character){
 const color=themeColor(character);if(!color)return {};
 return {'--character-color':color,'--character-ink-light':readableColor(color,'#c1c4c3'),'--character-ink-dark':readableColor(color,'#4d514f',true)};
}
