(() => {
  const $ = id => document.getElementById(id);
  const lobby=$('lobby'), gameScreen=$('gameScreen'), canvas=$('game'), ctx=canvas.getContext('2d');
  let ws=null, myId=null, mySlot=0, roomCode='', state=null, connected=false, joined=false;
  let keys={left:false,right:false,jump:false}, jumpQueued=false, lastSend=0, cameraX=0, lastFrame=0, elapsed=0;
  const notes=["Even when we're far apart, we're in the same little adventure. ♡","You are my favourite notification. 💌","If I could teleport anywhere, I'd choose right beside you.","One day, no screen between us. Until then, one heart at a time. 🌷","You make ordinary days feel like the best level ever.","Distance is just the map. You're still my favourite place."];
  const palette={ink:'#65445c',pink:'#f27ca5',pink2:'#ffb3ca',cream:'#fff7f3',green:'#9dddb8',green2:'#75c99b',lav:'#cfc0f6',yellow:'#ffda87'};
  function setConnection(text,on){$('connectionText').textContent=text;document.querySelector('.online-pill').classList.toggle('connected',!!on)}
  function showError(text){$('lobbyError').textContent=text||''}
  function randomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
  $('randomBtn').addEventListener('click',()=>{$('roomCode').value=randomCode(); showError('New room code ready — share it with Akshaya.');});
  $('joinBtn').addEventListener('click',joinRoom);
  $('roomCode').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8));
  function joinRoom(){
    if(joined)return; const name=$('playerName').value.trim()||'Player'; roomCode=$('roomCode').value.trim().toUpperCase();
    if(roomCode.length<4){showError('Choose a room code with at least 4 letters or numbers.');return}
    showError('');$('joinBtn').disabled=true;$('joinBtn').textContent='Connecting…';
    const scheme=location.protocol==='https:'?'wss:':'ws:'; ws=new WebSocket(`${scheme}//${location.host}`);
    ws.addEventListener('open',()=>ws.send(JSON.stringify({type:'join',room:roomCode,name})));
    ws.addEventListener('message',e=>{let msg;try{msg=JSON.parse(e.data)}catch{return} handleMessage(msg)});
    ws.addEventListener('error',()=>{showError('Could not connect. Check the server and try again.');resetJoinButton()});
    ws.addEventListener('close',()=>{connected=false;setConnection('Disconnected',false);if(joined){$('waitingBanner').textContent='Connection lost. Refresh to reconnect.';$('waitingBanner').classList.remove('hidden')}});
  }
  function resetJoinButton(){$('joinBtn').disabled=false;$('joinBtn').innerHTML='Join our world <span>♡</span>'}
  function handleMessage(msg){
    if(msg.type==='error'){showError(msg.message);resetJoinButton();if(ws)ws.close();return}
    if(msg.type==='joined'){myId=msg.id;mySlot=msg.slot;roomCode=msg.room;joined=true;connected=true;lobby.classList.add('hidden');gameScreen.classList.remove('hidden');$('roomLabel').textContent=roomCode;setConnection('Connected',true);$('waitingBanner').classList.remove('hidden');return}
    if(msg.type==='state'){state=msg;connected=true;setConnection('Connected',true);const me=state.players.find(p=>p.id===myId);const other=state.players.find(p=>p.id!==myId);if(me){$('heartCount').textContent=`${state.hearts.filter(h=>h.taken).length} / ${state.hearts.length}`;$('playerOneLabel').textContent=me.name+' (you)';} $('playerTwoLabel').textContent=other?other.name:'Waiting for player 2…';$('waitingBanner').classList.toggle('hidden',!!other);$('winOverlay').classList.toggle('hidden',!state.won);return}
    if(msg.type==='chat'){const el=document.createElement('div');el.className='chat-bubble';const b=document.createElement('b');b.textContent=msg.from+': ';el.appendChild(b);el.appendChild(document.createTextNode(msg.text));$('chatMessages').appendChild(el);$('chatMessages').scrollTop=$('chatMessages').scrollHeight;while($('chatMessages').children.length>12)$('chatMessages').firstChild.remove()}
  }
  function send(obj){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))}
  $('restartBtn').addEventListener('click',()=>send({type:'restart'}));$('playAgainBtn').addEventListener('click',()=>send({type:'restart'}));
  $('leaveBtn').addEventListener('click',()=>{if(ws)ws.close();location.reload()});
  $('newNoteBtn').addEventListener('click',()=>{let next=notes[Math.floor(Math.random()*notes.length)];$('noteText').textContent=next});
  $('chatForm').addEventListener('submit',e=>{e.preventDefault();const text=$('chatInput').value.trim();if(text){send({type:'say',text});$('chatInput').value=''}});
  function setKey(k,v){if(!(k in keys))return;keys[k]=v;if(k==='jump'&&v)jumpQueued=true;document.querySelectorAll(`[data-control="${k}"]`).forEach(el=>el.classList.toggle('active',v))}
  document.querySelectorAll('[data-control]').forEach(btn=>{const k=btn.dataset.control;btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);setKey(k,true)});for(const ev of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,e=>{e.preventDefault();setKey(k,false)})});
  window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp',' ','a','d','w','A','D','W'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')setKey('left',true);if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')setKey('right',true);if(e.key==='ArrowUp'||e.key===' '||e.key==='w'||e.key==='W')setKey('jump',true)});
  window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')setKey('left',false);if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')setKey('right',false);if(e.key==='ArrowUp'||e.key===' '||e.key==='w'||e.key==='W')setKey('jump',false)});
  window.addEventListener('blur',()=>{Object.keys(keys).forEach(k=>setKey(k,false))});
  function roundRect(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.stroke()}}
  function heart(c,x,y,size,color){c.save();c.translate(x,y);c.scale(size/24,size/24);c.beginPath();c.moveTo(0,8);c.bezierCurveTo(-19,-4,-9,-15,0,-7);c.bezierCurveTo(9,-15,19,-4,0,8);c.fillStyle=color;c.fill();c.restore()}
  function drawCloud(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#ffffffb8';ctx.beginPath();ctx.arc(0,9,18,0,Math.PI*2);ctx.arc(22,0,24,0,Math.PI*2);ctx.arc(48,10,17,0,Math.PI*2);ctx.fill();ctx.fillRect(-3,9,54,17);ctx.restore()}
  function drawCharacter(p,idx){const x=p.x-cameraX,y=p.y;const body=idx===0?'#ffb8a5':'#c7b5f5',dark=idx===0?'#b9696c':'#7861a5';ctx.save();ctx.translate(x+20,y+20);if(p.face<0)ctx.scale(-1,1);ctx.fillStyle='#65445c20';ctx.beginPath();ctx.ellipse(0,24,17,4,0,0,Math.PI*2);ctx.fill();roundRect(ctx,-15,-15,30,34,11,body,'#ffffff');ctx.fillStyle='#694e67';ctx.beginPath();ctx.arc(-5,-3,2.2,0,Math.PI*2);ctx.arc(5,-3,2.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(0,2,4,0.1,Math.PI-.1);ctx.stroke();ctx.fillStyle=dark;ctx.beginPath();ctx.arc(0,-16,12,Math.PI,Math.PI*2);ctx.quadraticCurveTo(12,-14,10,-7);ctx.lineTo(7,-12);ctx.lineTo(3,-8);ctx.lineTo(-2,-12);ctx.lineTo(-8,-8);ctx.lineTo(-12,-13);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle='#8b6a81';ctx.font='bold 11px Nunito, sans-serif';ctx.textAlign='center';ctx.fillText(p.name,x+20,y-7)}
  function draw(){const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#e9e8ff');grad.addColorStop(.7,'#fff0f5');grad.addColorStop(1,'#ffe5df');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    for(let i=0;i<8;i++){const x=((i*177+50-cameraX*.15)%(w+100)+w+100)%(w+100)-30;drawCloud(x,35+(i%3)*35,.55+(i%2)*.18)}
    ctx.fillStyle='#fff4bb';ctx.beginPath();ctx.arc(820-cameraX*.06,65,28,0,Math.PI*2);ctx.fill();
    // rolling hills
    ctx.fillStyle='#c9efd9';ctx.beginPath();ctx.moveTo(0,290);for(let x=0;x<=w;x+=10)ctx.lineTo(x,285+Math.sin((x+cameraX*.12)/95)*20+Math.sin(x/43)*5);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
    ctx.fillStyle='#a5dfbd';ctx.beginPath();ctx.moveTo(0,340);for(let x=0;x<=w;x+=10)ctx.lineTo(x,335+Math.sin((x+cameraX*.2)/110)*24);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
    // ground
    ctx.fillStyle='#83ce9f';ctx.fillRect(0,380,w,50);ctx.fillStyle='#6dbd8c';ctx.fillRect(0,380,w,7);for(let x=0;x<w;x+=22){ctx.fillStyle=x%2?'#b1e6c5':'#78c998';ctx.fillRect(x,393,10,3)}
    if(!state){ctx.fillStyle='#9d7b91';ctx.font='bold 16px Nunito';ctx.textAlign='center';ctx.fillText('Connect to your room to begin ♡',w/2,h/2);requestAnimationFrame(draw);return}
    cameraX=0;const me=state.players.find(p=>p.id===myId);if(me)cameraX=Math.max(0,Math.min(state.world.width-w,me.x-w*.35));
    for(const pl of state.world.platforms){const x=pl.x-cameraX;if(x<-220||x>w+50)continue;roundRect(ctx,x,pl.y-20,pl.w,pl.h+20,8,'#f8d7e5');roundRect(ctx,x,pl.y-5,pl.w,pl.h+5,7,'#85d2a4');for(let i=8;i<pl.w;i+=22){ctx.fillStyle='#b8e8c8';ctx.beginPath();ctx.arc(x+i,pl.y-5,3,Math.PI,Math.PI*2);ctx.fill()}}
    // hearts to collect
    for(const ht of state.hearts){if(ht.taken)continue;const x=ht.x-cameraX;if(x<-30||x>w+30)continue;const bob=Math.sin(performance.now()/230+ht.id)*4;ctx.save();ctx.shadowColor='#f47da9';ctx.shadowBlur=12;heart(ctx,x,ht.y+bob,25,'#f37ca5');ctx.restore();ctx.fillStyle='#fff4f7';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('✦',x,ht.y+bob-2)}
    // finish rainbow marker
    const finish=state.world.width-90-cameraX;if(finish>-30&&finish<w+40){ctx.strokeStyle='#fff';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(finish,380);ctx.lineTo(finish,260);ctx.stroke();ctx.fillStyle='#f7a1c0';ctx.beginPath();ctx.moveTo(finish,263);ctx.lineTo(finish+55,278);ctx.lineTo(finish,294);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 12px Nunito';ctx.textAlign='center';ctx.fillText('LOVE',finish+16,281)}
    state.players.forEach((p,i)=>drawCharacter(p,i));
    if(connected&&joined&&!state.won&&state.players.length===2&&performance.now()-lastSend>35){send({type:'input',left:keys.left,right:keys.right,jump:jumpQueued});jumpQueued=false;lastSend=performance.now()}
    requestAnimationFrame(draw)}
  // Keep canvas rendering crisp on high-density displays while preserving logical world coordinates.
  function resizeCanvas(){const dpr=Math.min(window.devicePixelRatio||1,2);const rect=canvas.getBoundingClientRect();if(rect.width&&rect.height){canvas.width=960;canvas.height=430;ctx.setTransform(1,0,0,1,0,0)}}
  window.addEventListener('resize',resizeCanvas);resizeCanvas();draw();
})();
