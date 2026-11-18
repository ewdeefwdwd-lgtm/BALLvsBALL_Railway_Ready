'use strict';
// BALLvsBALL: dependency-free Node.js static web server + WebSocket private rooms.
// Run: DEV_CODE=your_private_code node server.js  (default DEV2026 for local testing).
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const PORT=Number(process.env.PORT||3000);
const CODE=process.env.DEV_CODE||null;
const SECRET=process.env.DEV_SIGNING_SECRET||crypto.randomBytes(32).toString('hex');
const ROOT=__dirname;
const rooms=new Map();
const peers=new Set();
const ALLOWED=new Set(['start','ready','sync','round','end','leave']);
const safeName=v=>String(v||'Guest').replace(/[^\w .-]/g,'').slice(0,18)||'Guest';
function tokenFor(name){const payload=Buffer.from(JSON.stringify({n:name,exp:Date.now()+365*86400e3})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',SECRET).update(payload).digest('base64url')}
function verifyToken(token,name){try{const [data,signature]=String(token||'').split('.');if(!data||!signature)return false;const expected=crypto.createHmac('sha256',SECRET).update(data).digest();const got=Buffer.from(signature,'base64url');if(expected.length!==got.length||!crypto.timingSafeEqual(expected,got))return false;const p=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));return p.n===name&&p.exp>Date.now()}catch{return false}}
function send(c,obj){if(c.closed)return;const body=Buffer.from(JSON.stringify(obj));if(body.length>65535)return;let head;if(body.length<126){head=Buffer.from([0x81,body.length])}else{head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(body.length,2)}try{if(c.socket.writable&&c.socket.writableLength<500_000)c.socket.write(Buffer.concat([head,body]))}catch{leave(c)}}
function info(c){return c?{name:c.name,avatar:c.avatar,dev:!!c.dev}:null}
function sendRoom(room){for(const c of [room.host,room.guest])if(c)send(c,{type:'room',code:room.code,role:c===room.host?'host':'guest',host:info(room.host),guest:info(room.guest),ready:!!room.guest})}
function leave(c){if(c.closed)return;c.closed=true;peers.delete(c);if(c.room){const r=c.room;c.room=null;if(r.host===c){rooms.delete(r.code);if(r.guest){const other=r.guest;other.room=null;send(other,{type:'room_closed',reason:'Host disconnected. Create or join another room.'})}}else if(r.guest===c){r.guest=null;sendRoom(r)}}try{c.socket.destroy()}catch{}}
function handle(c,msg){if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
 if(msg.type==='hello'){c.name=safeName(msg.name);c.avatar=['happy','cool','robot','alien','cat','crown'].includes(msg.avatar)?msg.avatar:'happy';c.dev=verifyToken(msg.devToken,c.name);send(c,{type:'welcome',dev:c.dev});if(c.room)sendRoom(c.room);return}
 if(!c.name){send(c,{type:'error',message:'Please connect first'});return}
 if(msg.type==='redeem'){
   if(!CODE||String(msg.code||'').toUpperCase()!==CODE.toUpperCase()){send(c,{type:'redeem_error',message:'Invalid developer code'});return}
   c.dev=true;const token=tokenFor(c.name);send(c,{type:'dev_unlocked',token});if(c.room)sendRoom(c.room);return
 }
 if(msg.type==='create'){
  if(c.room){send(c,{type:'error',message:'Leave your room first'});return}
  if(rooms.size>=1000){send(c,{type:'error',message:'Server is full'});return}
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code;
  do{code=Array.from(crypto.randomBytes(6),b=>chars[b%chars.length]).join('')}while(rooms.has(code));
  const room={code,host:c,guest:null};rooms.set(code,room);c.room=room;sendRoom(room);return
 }
 if(msg.type==='join'){
  if(c.room){send(c,{type:'error',message:'Leave your current room first'});return}
  const code=String(msg.code||'').trim().toUpperCase();const room=rooms.get(code);
  if(!room||room.guest){send(c,{type:'error',message:'Room not found or already full'});return}
  room.guest=c;c.room=room;sendRoom(room);return
 }
 if(msg.type==='leave'){if(c.room){const r=c.room;c.room=null;if(r.host===c){rooms.delete(r.code);if(r.guest){r.guest.room=null;send(r.guest,{type:'room_closed',reason:'Host left the room.'})}}else{r.guest=null;sendRoom(r)}}send(c,{type:'left'});return}
 if(msg.type==='peer'&&c.room&&c.room.guest&&ALLOWED.has(msg.event)){
  if(['start','sync','round','end'].includes(msg.event)&&c!==c.room.host)return;
  const partner=c===c.room.host?c.room.guest:c.room.host;
  if(msg.event==='ready'&&msg.payload){const ball=String(msg.payload.ball||'');if(['harpoon','cell'].includes(ball)&&!c.dev){send(c,{type:'error',message:'Developer ball requires verified developer access'});return}}
  send(partner,{type:'peer',event:msg.event,payload:msg.payload??null,from:c===c.room.host?'host':'guest'});
 }
}
function websocketData(c,part){c.buffer=Buffer.concat([c.buffer,part]);if(c.buffer.length>300000){leave(c);return}while(c.buffer.length>=2){const b=c.buffer,opcode=b[0]&15,masked=!!(b[1]&128);let size=b[1]&127,offset=2;if(!masked){leave(c);return}if(size===126){if(b.length<4)return;size=b.readUInt16BE(2);offset=4}else if(size===127){leave(c);return}if(size>65535){leave(c);return}if(b.length<offset+4+size)return;const mask=b.subarray(offset,offset+4),payload=Buffer.from(b.subarray(offset+4,offset+4+size));c.buffer=b.subarray(offset+4+size);for(let i=0;i<size;i++)payload[i]^=mask[i&3];if(opcode===8){leave(c);return}else if(opcode===9){send(c,{type:'ping'});continue}else if(opcode!==1){continue}try{handle(c,JSON.parse(payload.toString('utf8')))}catch{send(c,{type:'error',message:'Invalid message'})}}}
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size,players:peers.size}));return}
 const filename=pathname==='/'?'/index.html':pathname;
 if(!['/index.html','/favicon.svg'].includes(filename)){res.writeHead(404);res.end('Not found');return}
 const file=path.join(ROOT,filename.slice(1));fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':filename.endsWith('svg')?'image/svg+xml':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data)})
});
server.on('upgrade',(req,socket,head)=>{
 if(new URL(req.url,'http://localhost').pathname!=='/ws'){socket.destroy();return}
 const key=req.headers['sec-websocket-key'];if(req.headers.upgrade?.toLowerCase()!=='websocket'||typeof key!=='string'||peers.size>=3000){socket.destroy();return}
 const accept=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 const c={socket,buffer:Buffer.alloc(0),closed:false,name:'',avatar:'happy',dev:false,room:null};peers.add(c);socket.on('data',data=>websocketData(c,data));socket.on('close',()=>leave(c));socket.on('error',()=>leave(c));if(head.length)websocketData(c,head);
});
server.listen(PORT,'0.0.0.0',()=>console.log('BALLvsBALL listening on http://localhost:'+PORT));
