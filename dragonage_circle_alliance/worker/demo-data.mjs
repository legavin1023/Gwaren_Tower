// Local-only, synthetic fixtures. This module is not imported by the production entry point.
const uuid=n=>'d3a00000-0000-4000-8000-'+String(n).padStart(12,'0');
const localId='local-developer';
const encode=value=>typeof value==='object'&&value!==null?JSON.stringify(value):typeof value==='boolean'?Number(value):value??null;
function crc32(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
function concat(...arrays){const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of arrays){out.set(a,offset);offset+=a.length;}return out;}
function chunk(type,bytes){const name=new TextEncoder().encode(type),out=new Uint8Array(bytes.length+12),view=new DataView(out.buffer);view.setUint32(0,bytes.length);out.set(name,4);out.set(bytes,8);view.setUint32(out.length-4,crc32(concat(name,bytes)));return out;}
export async function demoImage(width,height,seed=0){
 const colors=[[93,112,105],[113,94,83],[101,107,122],[91,112,119],[112,106,88],[100,87,110]];
 const base=colors[seed%colors.length],scanlines=new Uint8Array((width*3+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const nx=x/width,ny=y/height;
  const arch=(nx>.27&&nx<.73&&ny>.36&&ny<.88)||(((nx-.5)/.23)**2+((ny-.36)/.23)**2<1&&ny<=.36);
  const frame=x<8||x>=width-8||y<8||y>=height-8;
  const mullion=arch&&(Math.abs(nx-.5)<.009||Math.abs(ny-.49)<.008);
  const shade=frame?-29:arch?(mullion?-55:-(17+seed%4*3)):(22*(1-ny)+(((x*13+y*7+seed)%11)-5)*.4);
  const offset=y*(width*3+1)+1+x*3;
  for(let c=0;c<3;c++)scanlines[offset+c]=Math.max(0,Math.min(255,Math.round(base[c]+shade)));
 }
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,width);view.setUint32(4,height);header[8]=8;header[9]=2;
 const compressed=new Uint8Array(await new Response(new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 return concat(new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array()));
}
export function demoRows(now=Date.now()){
 const at=minutes=>new Date(now-minutes*60000).toISOString(),stamp=at(240);
 const memberIds=[localId,uuid(11),uuid(12),uuid(13)];
 const members=[{id:localId,email:'developer@circle.local',nickname:'로컬 관리자',role:'admin',active:1},{id:memberIds[1],email:'librarian@demo.invalid',nickname:'서고지기',role:'admin',active:1},{id:memberIds[2],email:'courtyard@demo.invalid',nickname:'회랑의 손님',role:'member',active:1},{id:memberIds[3],email:'sleeping@demo.invalid',nickname:'잠든 등불',role:'member',active:0}].map(m=>({...m,created_at:stamp,updated_at:stamp}));
 const specs=[['에이라 베인','mage','인간',localId,'고문서 연구원','마탑 수호파'],['로웬 애쉬','templar','인간',localId,'동쪽 회랑의 파수꾼','중립'],['네리스','mage','엘프',memberIds[2],'약초학 수련생','자유파'],['도란 칼드','templar','드워프',memberIds[1],'창고와 기록실의 관리인','마탑 수호파'],['바샤드','mage','쿠나리',memberIds[2],'마법 이론 연구 조수','중립'],['이셀라','mage','엘프',localId,'야간 서고 담당','자유파']];
 const characters=specs.map(([name,faction,race,owner_id,position,side],i)=>({id:uuid(100+i),owner_id,name,alias:i===0?'잿빛 잉크':'',faction,age:String(24+i*4),race,origin:i%2?'해안의 작은 도시':'마탑 인근의 마을',position,personality:'신중함 · 고집 · 관찰력\n말보다 오래 지켜보는 쪽을 택한다. 익숙한 사람 앞에서는 뜻밖의 농담을 건네기도 한다.',background:'오랜 돌벽과 높은 창 사이에서 하루를 보낸다.\n입탑 전의 삶에 관해서는 필요한 만큼만 이야기한다. 서고의 기록을 정리하는 일은 과거를 이해하려는 작은 시도이기도 하다.',goals:'잃어버린 기록을 찾고, 자신이 선택할 수 있는 미래를 남기는 것.\n규율과 자유 사이에서 누군가를 쉽게 단정하지 않으려 한다.',secrets:'[샘플 비밀 설정] 오래전 사라진 문서의 한 장을 보관하고 있다. 캐릭터들은 모르지만 오너들은 이 설정을 공유한다.',extra:{quote:i===0?'기록되지 않은 것까지 사라지는 것은 아니야.':'돌벽 너머의 소리도 듣고 있어.',affiliation:'그웨런 마탑',circle_faction:side,motivation:'통제되지 않는 힘에 대한 두려움과 잃어버린 장소에 대한 미련.\n완벽해야만 받아들여질 수 있다는 생각을 쉽게 놓지 못한다.',appearance:'빛바랜 옷감과 손때가 묻은 장갑. 오래 걸어 닳은 신발을 신는다.\n좁은 창으로 들어온 빛 아래에서 머리카락의 색이 조금 달라 보인다.',other:'오래된 책의 여백에 메모를 남기는 습관이 있다.\n좋아하는 것: 비 오는 회랑, 정리된 책상\n꺼리는 것: 갑작스러운 큰 소리',relationship_direction:'천천히 신뢰를 쌓는 동료, 사소한 충돌에서 시작되는 우정, 오래 묻어 둔 비밀을 함께 마주하는 관계를 희망합니다.'},image_path:owner_id+'/local-demo/portrait-'+(i+1)+'.png',created_at:at(220-i),updated_at:at(100-i),revision:1}));
 const posts=[
  {id:uuid(201),owner_id:localId,category:'notice',title:'[샘플] 마탑의 문을 여는 이들에게',body:'이 글은 로컬 디자인 확인을 위한 공지 샘플입니다.\n캐릭터 프로필, 관계도, 그림·로그와 댓글 화면을 자유롭게 확인해 주세요.\n운영 사이트에는 이 데이터가 올라가지 않습니다.',character_ids:[]},
  {id:uuid(202),owner_id:memberIds[1],character_id:characters[3].id,category:'story',title:'[샘플] 서고의 마지막 등불이 꺼지기 전에',body:'저녁 점호가 끝난 뒤에도 서고에는 한 사람이 남아 있었다.\n@[에이라 베인]('+characters[0].id+')에게 빌린 책은 아직 돌려주지 못했다. 여백에 적힌 한 줄이 마음에 걸렸기 때문이다.\n\n창문을 두드리는 빗소리 사이로 발걸음이 들렸다.',character_ids:[characters[0].id,characters[3].id]},
  {id:uuid(203),owner_id:localId,character_id:characters[1].id,category:'story',title:'[샘플] 오래된 문 앞에서 나눈 짧은 대화',body:'“오늘도 늦었군요.”\n회랑 끝에서 기다리던 이가 조용히 말했다.\n\n@[네리스]('+characters[2].id+')는 대답 대신 접어 둔 종이를 내밀었다.\n짧은 글과 긴 글의 줄바꿈을 확인할 수 있는 샘플입니다.',character_ids:[characters[1].id,characters[2].id]},
  {id:uuid(204),owner_id:localId,character_id:characters[0].id,category:'art',title:'[샘플] 비 내리는 마탑 — 가로·세로·정사각 이미지',body:'서로 다른 이미지 비율과 목록 썸네일을 확인하는 그림·로그 샘플입니다.\n@[이셀라]('+characters[5].id+')와 함께한 늦은 오후의 기록.',character_ids:[characters[0].id,characters[5].id]},
  {id:uuid(205),owner_id:localId,category:'art',title:'[샘플] 열 장의 기록 — 첨부 10장 레이아웃',body:'첨부 이미지 10개, 이미지 갤러리, 글 수정 시 미리보기 칸을 확인할 수 있습니다.',character_ids:[characters[0].id,characters[1].id,characters[2].id]},
  {id:uuid(206),owner_id:memberIds[2],character_id:characters[2].id,category:'art',title:'[샘플] 아직 그림을 붙이지 않은 로그',body:'이미지 없는 글이 같은 목록에서 어떻게 보이는지 확인하는 샘플입니다.',character_ids:[characters[2].id]},
  {id:uuid(207),owner_id:memberIds[1],category:'notice',title:'[샘플] 서고 정리와 교류에 관한 안내',body:'공지 목록에서 제목 길이와 작성일을 확인하는 두 번째 샘플입니다.',character_ids:[]}
 ].map((row,i)=>({...row,created_at:at(170-i*15),updated_at:at(170-i*15),revision:1}));
 const relationships=[
  {id:uuid(301),source_id:characters[0].id,target_id:characters[2].id,name:'빌려 간 책과 돌려주지 않은 편지',kind:'친구',description:'같은 책을 찾다가 알게 된 사이. 서로 다른 생각 때문에 종종 부딪히지만, 누구보다 먼저 상대의 부재를 알아차린다.',directed:0,status:'approved'},
  {id:uuid(302),source_id:characters[1].id,target_id:characters[3].id,name:'야간 순찰의 동료',kind:'동료',description:'긴 회랑을 나란히 걷는 동안 조금씩 신뢰가 쌓였다.',directed:0,status:'approved'},
  {id:uuid(303),source_id:characters[2].id,target_id:characters[5].id,name:'새벽 서고에서 만난 사람',kind:'동료',description:'[샘플] 수락·거절 버튼을 확인할 수 있는 받은 관계 제안입니다.',directed:0,status:'pending'},
  {id:uuid(304),source_id:characters[0].id,target_id:characters[4].id,name:'말하지 못한 의심',kind:'일방적 감정',description:'[샘플] 내가 보낸 제안. 상대의 답변을 기다리고 있다.',directed:1,status:'pending'},
  {id:uuid(305),source_id:characters[5].id,target_id:characters[3].id,name:'한 번 어긋난 약속',kind:'라이벌',description:'[샘플] 거절된 관계와 다시 제안 버튼을 확인하는 기록.',directed:0,status:'rejected'},
  {id:uuid(306),source_id:characters[0].id,target_id:characters[1].id,name:'같은 벽을 바라보는 사이',kind:'동료',description:'말이 없어도 침묵을 견딜 수 있는 오래된 동료.',directed:0,status:'approved'}
 ].map((row,i)=>({...row,created_at:at(140-i*4),updated_at:at(140-i*4),revision:1}));
 const affection=[{id:uuid(351),source_id:characters[0].id,target_id:characters[2].id,value:75,note:'함께 있으면 오래된 걱정도 조금은 가벼워진다.'},{id:uuid(352),source_id:characters[2].id,target_id:characters[0].id,value:45,note:'신뢰하지만, 말하지 않는 이야기가 궁금하다.'},{id:uuid(353),source_id:characters[1].id,target_id:characters[0].id,value:90,note:'어떤 결정을 하더라도 먼저 들어 보고 싶은 사람.'}].map(row=>({...row,created_at:at(120),updated_at:at(50),revision:1}));
 const comments=[
  {id:uuid(401),owner_id:memberIds[2],character_id:characters[2].id,post_id:posts[3].id,body:'[샘플] 창문으로 들어오는 빛이 멋져요. @[에이라 베인]('+characters[0].id+')의 다음 기록도 기대하고 있습니다.'},
  {id:uuid(402),owner_id:localId,character_id:characters[0].id,post_id:posts[3].id,parent_id:uuid(401),body:'[샘플 답글] 다음에는 서고의 계단도 함께 그려 볼까요? 답글의 들여쓰기와 버튼을 확인할 수 있습니다.'},
  {id:uuid(403),owner_id:memberIds[1],post_id:posts[3].id,body:'[샘플] 오너 이름으로 남긴 댓글입니다. 대표 캐릭터 프사와 링크를 확인할 수 있습니다.'},
  {id:uuid(404),owner_id:memberIds[2],character_id:characters[4].id,target_id:characters[0].id,body:'[샘플 교류] 빌려주신 노트는 내일 회랑에서 돌려드리겠습니다.'},
  {id:uuid(405),owner_id:localId,target_id:characters[0].id,parent_id:uuid(404),body:'[샘플 오너 답글] 일정과 교류 기록을 남기는 자리입니다.'},
  {id:uuid(406),owner_id:memberIds[1],character_id:characters[3].id,post_id:posts[1].id,body:'[샘플] 짧은 댓글.'},
  {id:uuid(407),owner_id:localId,post_id:posts[1].id,body:'[샘플] 긴 댓글의 줄바꿈 확인.\n첫 번째 문단에서는 오늘의 기록을 정리합니다.\n\n두 번째 문단에서는 다음 이야기를 이어갈 수 있도록 여백을 둡니다. 여러 줄의 내용과 댓글 수정·삭제 버튼 배치를 함께 확인해 주세요.'}
 ].map((row,i)=>({...row,created_at:at(40-i*4),updated_at:at(40-i*4),revision:1}));
 const media=[],assets=characters.map((character,i)=>({path:character.image_path,owner_id:character.owner_id,width:360,height:480,seed:i}));
 function attach(post,character,count,offset){for(let i=0;i<count;i++){
  const owner_id=post?.owner_id||character?.owner_id||localId,path=owner_id+'/local-demo/image-'+(offset+i)+'.png';
  media.push({id:uuid(500+offset+i),owner_id,post_id:post?.id||null,character_id:character?.id||null,path,caption:'[샘플 이미지 '+(i+1)+'] 회랑과 창의 기록',created_at:at(70-i),updated_at:at(70-i),revision:1});
  const sizes=[[720,440],[440,680],[540,540]][i%3];assets.push({path,owner_id,width:sizes[0],height:sizes[1],seed:i+offset});
 }}
 attach(posts[3],null,3,1);attach(posts[4],null,10,20);attach(null,characters[0],2,40);attach(null,null,2,50);
 const notifications=[
  {kind:'tag',reasons:['new_post','tag'],title:'[샘플] 서고지기님이 내 캐릭터를 태그했습니다',body:posts[1].title,url:'#/board/story/'+posts[1].id},
  {kind:'own_comment',reasons:['new_comment','own_comment'],title:'[샘플] 내 그림·로그에 댓글이 달렸습니다',body:comments[0].body,url:'#/board/art/'+posts[3].id},
  {kind:'new_post',reasons:['new_post'],title:'[샘플] 새 공지가 올라왔습니다',body:posts[0].title,url:'#/board/notice/'+posts[0].id},
  {kind:'own_comment',reasons:['new_comment','own_comment'],title:'[샘플] 캐릭터 소개에 교류 기록이 남겨졌습니다',body:comments[3].body,url:'#/characters/'+characters[0].id},
  {kind:'new_comment',reasons:['new_comment'],title:'[샘플·읽음] 새로운 댓글',body:'읽은 알림과 안 읽은 알림의 스타일 비교',url:'#/board/story/'+posts[1].id,read_at:at(5)},
 ].map((row,i)=>({...row,id:uuid(701+i),member_id:localId,event_key:'local-demo:'+i,created_at:at(15-i)}));
 const before={...characters[0],extra:{...characters[0].extra},name:'에이라 — 수정 전 이름'};
 const history=[{id:uuid(801),table_name:'characters',record_id:characters[0].id,actor_id:localId,action:'update',before_json:JSON.stringify(before),after_json:JSON.stringify(characters[0]),created_at:at(20)}];
 return {members,characters,posts,relationships,affection,comments,media,assets,notifications,history};
}
export async function seedLocalDemo(env){
 if(env.LOCAL_DEVELOPMENT!=='1')throw new Error('Local demo data is disabled outside local development.');
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS local_demo_seeds(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL)').run();
 if(await env.DB.prepare('SELECT id FROM local_demo_seeds WHERE id=1').first())return {seeded:false,message:'샘플 데이터가 이미 있습니다. 로컬에서 수정한 내용은 유지했습니다.'};
 const data=demoRows(),uploads=[],cache=new Map();
 for(const asset of data.assets){
  const key=[asset.width,asset.height,asset.seed%6].join(':');
  if(!cache.has(key))cache.set(key,await demoImage(asset.width,asset.height,asset.seed));
  const bytes=cache.get(key);
  if(!await env.MEDIA.head(asset.path))await env.MEDIA.put(asset.path,bytes,{httpMetadata:{contentType:'image/png'}});
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  uploads.push({path:asset.path,owner_id:asset.owner_id,bytes:bytes.length,mime:'image/png',sha256:digest,created_at:new Date().toISOString()});
  const media=data.media.find(item=>item.path===asset.path);if(media){media.bytes=bytes.length;media.mime='image/png';}
 }
 const statements=[];
 for(const table of ['members','characters','posts','relationships','affection','comments','uploads','media','notifications','history'])for(const row of table==='uploads'?uploads:data[table]){
  const keys=Object.keys(row);statements.push(env.DB.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).bind(...keys.map(key=>encode(row[key]))));
 }
 for(const [member,character] of [[localId,data.characters[0].id],[data.members[1].id,data.characters[3].id],[data.members[2].id,data.characters[2].id]])statements.push(env.DB.prepare('UPDATE members SET representative_character_id=? WHERE id=? AND representative_character_id IS NULL').bind(character,member));
 statements.push(env.DB.prepare('INSERT OR IGNORE INTO local_demo_seeds(id,created_at) VALUES(1,?)').bind(new Date().toISOString()));
 await env.DB.batch(statements);
 return {seeded:true,characters:data.characters.length,posts:data.posts.length,relationships:data.relationships.length,comments:data.comments.length,images:uploads.length,notifications:data.notifications.length};
}
