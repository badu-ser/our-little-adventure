'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(ROOT, '.' + requested);
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'Cache-Control':'no-cache'});
    res.end(data);
  });
});
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const rooms = new Map();
const WORLD = { width: 2400, height: 430, ground: 380, platforms: [{x:260,y:300,w:170,h:18},{x:520,y:250,w:160,h:18},{x:790,y:310,w:190,h:18},{x:1110,y:230,w:170,h:18},{x:1410,y:295,w:190,h:18},{x:1730,y:225,w:190,h:18},{x:2040,y:310,w:150,h:18}] };
function cleanName(s, fallback) { return String(s || fallback).replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,22) || fallback; }
function roomSnapshot(room) {
  return { type:'state', room:room.code, players:[...room.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,face:p.face,grounded:p.grounded,hearts:p.hearts,connected:true})), hearts:room.hearts, started:room.started, won:room.won, world:WORLD };
}
function broadcast(room) {
  const msg = JSON.stringify(roomSnapshot(room));
  for (const p of room.players.values()) if (p.ws.readyState === 1) p.ws.send(msg);
}
function makeRoom(code) {
  return { code, players:new Map(), hearts:[{id:0,x:180,y:325,taken:false},{id:1,x:355,y:255,taken:false},{id:2,x:595,y:205,taken:false},{id:3,x:855,y:270,taken:false},{id:4,x:1180,y:185,taken:false},{id:5,x:1495,y:255,taken:false},{id:6,x:1825,y:180,taken:false},{id:7,x:2110,y:270,taken:false}], started:false, won:false, lastActivity:Date.now() };
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
wss.on('connection', ws => {
  let player = null; let room = null;
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return send(ws,{type:'error',message:'Invalid message.'}); }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'join') {
      if (player) return;
      const code = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
      if (!/^[A-Z0-9]{4,8}$/.test(code)) return send(ws,{type:'error',message:'Room code must be 4–8 letters or numbers.'});
      room = rooms.get(code) || makeRoom(code);
      if (room.players.size >= 2) return send(ws,{type:'error',message:'This room already has two players. Create another room.'});
      rooms.set(code, room);
      const slot = room.players.size;
      player = { id:crypto.randomUUID(), ws, name:cleanName(msg.name, slot === 0 ? 'You' : 'Akshaya'), x:slot===0?70:120, y:WORLD.ground-48, face:1, grounded:true, hearts:0, lastInput:0 };
      room.players.set(player.id, player); room.lastActivity = Date.now();
      send(ws,{type:'joined',id:player.id,slot,room:code,world:WORLD}); broadcast(room);
      return;
    }
    if (!player || !room || player.ws !== ws) return;
    room.lastActivity = Date.now();
    if (msg.type === 'input') {
      const left = !!msg.left, right = !!msg.right, jump = !!msg.jump;
      const now = Date.now(); if (now - player.lastInput < 12) return; player.lastInput = now;
      const speed = 4.4;
      if (left !== right) { player.x += right ? speed : -speed; player.face = right ? 1 : -1; }
      player.x = Math.max(0, Math.min(WORLD.width-42, player.x));
      if (jump && player.grounded) { player.vy = -11.2; player.grounded = false; }
      // Host-authoritative lightweight physics; inputs arrive frequently from both players.
      player.vy = Number(player.vy || 0) + 0.48;
      player.y += player.vy;
      player.grounded = false;
      const feet = player.y + 42;
      if (feet >= WORLD.ground) { player.y = WORLD.ground-42; player.vy = 0; player.grounded = true; }
      for (const pl of WORLD.platforms) {
        if (player.vy >= 0 && player.x+32 > pl.x && player.x+8 < pl.x+pl.w && player.y+42 >= pl.y && player.y+42 <= pl.y+pl.h+10) {
          player.y = pl.y-42; player.vy = 0; player.grounded = true;
        }
      }
      for (const heart of room.hearts) {
        if (!heart.taken && Math.abs((player.x+20)-heart.x) < 31 && Math.abs((player.y+20)-heart.y) < 34) { heart.taken = true; player.hearts++; }
      }
      if (room.hearts.every(h=>h.taken)) room.won = true;
      broadcast(room);
    }
    if (msg.type === 'restart') {
      room.hearts.forEach(h=>h.taken=false); room.won=false;
      for (const p of room.players.values()) { p.x = p.id === player.id ? 70 : 120; p.y = WORLD.ground-42; p.vy=0; p.grounded=true; p.hearts=0; }
      broadcast(room);
    }
    if (msg.type === 'say') {
      const text = String(msg.text || '').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,120);
      if (text) for (const p of room.players.values()) send(p.ws,{type:'chat',from:player.name,text});
    }
  });
  ws.on('close', () => { if (player && room) { room.players.delete(player.id); if (!room.players.size) rooms.delete(room.code); else broadcast(room); } });
});
setInterval(() => { const cutoff=Date.now()-6*60*60*1000; for (const [code,room] of rooms) if (!room.players.size || room.lastActivity<cutoff) rooms.delete(code); }, 60*1000).unref();
server.listen(PORT, '0.0.0.0', () => console.log(`Akshaya Love Adventure running on port ${PORT}`));
