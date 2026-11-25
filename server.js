const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 3000;
const GID = process.env.GOOGLE_CLIENT_ID || '';
const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.MODEL || 'claude-haiku-5-5';
const ICE = process.env.ICE_SERVERS ? JSON.parse(process.env.ICE_SERVERS) : [{ urls: 'stun:stun.l.google.com:19302' }];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const PUB = __dirname;
const ALLOW = new Set(['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png']);

const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ gid: GID, ice: ICE, translate: !!KEY }));
  }
  const name = u === '/' ? 'index.html' : u.slice(1);
  const f = path.join(PUB, name);
  if (!ALLOW.has(name) || !fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
let queue = [];
const bans = new Map(), reps = new Map();
const send = (w, o) => w.readyState === 1 && w.send(JSON.stringify(o));

async function verify(cred) {
  if (!GID) return { id: 'guest-' + Math.random().toString(36).slice(2, 9) }; // dev mode without Google
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
  const j = await r.json();
  if (!r.ok || j.aud !== GID || String(j.email_verified) !== 'true') return null;
  return { id: j.sub };
}
function unpair(w, notify) {
  queue = queue.filter(x => x !== w);
  const p = w.peer; w.peer = null;
  if (p) { p.peer = null; if (notify) send(p, { t: 'bye' }); }
}
function pair(w) {
  const i = queue.findIndex(o => o !== w && (w.f === 'all' || w.f === o.c) && (o.f === 'all' || o.f === w.c));
  if (i < 0) { if (!queue.includes(w)) queue.push(w); return; }
  const o = queue.splice(i, 1)[0];
  queue = queue.filter(x => x !== w);
  w.peer = o; o.peer = w;
  send(w, { t: 'match', init: true, c: o.c });
  send(o, { t: 'match', init: false, c: w.c });
}
async function translate(text, lang) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content:
      `Detect the language of this speech transcript and translate it into ${lang}. Reply exactly as LANGUAGE|TRANSLATION where LANGUAGE is the source language name in English. If it is already ${lang}, repeat it unchanged.\n\n${text}` }] })
  });
  const j = await r.json();
  return ((j.content && j.content[0] && j.content[0].text) || '').trim();
}

wss.on('connection', w => {
  w.user = null; w.last = 0;
  w.on('message', async raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'auth') {
      if (!m.adult) return send(w, { t: 'denied', why: 'You must confirm you are 18 or older.' });
      const u = await verify(String(m.cred || '')).catch(() => null);
      if (!u) return send(w, { t: 'denied', why: 'Sign-in failed.' });
      if ((bans.get(u.id) || 0) > Date.now()) return send(w, { t: 'denied', why: 'This account is suspended after reports.' });
      w.user = u; return send(w, { t: 'ready' });
    }
    if (!w.user) return;
    if (m.t === 'find') { unpair(w, true); w.c = String(m.c || '').slice(0, 40); w.f = String(m.f || 'all').slice(0, 40); pair(w); }
    else if (m.t === 'next' || m.t === 'stop') unpair(w, true);
    else if (m.t === 'sig' && w.peer) send(w.peer, { t: 'sig', d: m.d });
    else if (m.t === 'report' && w.peer) {
      const id = w.peer.user.id, n = (reps.get(id) || 0) + 1;
      reps.set(id, n); console.log('REPORT', id, n);
      if (n >= 3) { bans.set(id, Date.now() + 864e5); send(w.peer, { t: 'denied', why: 'Suspended after reports.' }); }
      unpair(w, true);
    }
    else if (m.t === 'tr' && KEY && Date.now() - w.last > 700) {
      w.last = Date.now();
      translate(String(m.text || '').slice(0, 500), String(m.lang || 'English').slice(0, 30))
        .then(out => send(w, { t: 'tr', id: m.id, out })).catch(() => {});
    }
  });
  w.on('close', () => unpair(w, true));
});
setInterval(() => { const n = wss.clients.size; wss.clients.forEach(w => send(w, { t: 'online', n })); }, 5000);
server.listen(PORT, () => console.log('Bobo TV running on port ' + PORT));
