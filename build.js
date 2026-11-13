// Scans Claude Code transcripts (~/.claude/projects/**/*.jsonl), writes stats.html, opens it.
// cache.json keeps one summary per transcript: unchanged files are not re-read, and
// transcripts Claude Code later deletes still count.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { exec, execFile } = require('child_process');

const ROOT = path.join(os.homedir(), '.claude', 'projects');
const HERE = __dirname;
const CACHE = path.join(HERE, 'cache.json');
const CACHE_VERSION = 2; // bump when the counting rules change

// Opens stats.html in the default browser: start (Windows), open (macOS), xdg-open (Linux).
function openFile(file) {
  const done = (err) => { if (err) console.log(`Ouvre ce fichier dans ton navigateur : ${file}`); };
  if (process.platform === 'win32') exec(`start "" "${file}"`, done);
  else execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [file], done);
}


function listJsonl(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listJsonl(p, out);
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

// "claude-opus-4-5-20251101" -> "Opus 4.5", "claude-3-5-sonnet-20241022" -> "Sonnet 3.5"
function modelName(id) {
  const m = id.replace(/\[.*\]$/, '').replace(/^claude-/, '').replace(/-\d{8}$/, '');
  const parts = m.split('-');
  const fam = parts.find(p => !/^\d+$/.test(p));
  const ver = parts.filter(p => /^\d+$/.test(p)).join('.');
  if (!fam || !id.startsWith('claude')) return id;
  return fam[0].toUpperCase() + fam.slice(1) + (ver ? ' ' + ver : '');
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Per-file summary: { [day]: { m: messages, s: [sessionIds], h: { hour: n }, mo: { model: [tokens, replies] } } }
async function scanFile(file) {
  const days = {};
  const seenMsg = new Set();
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if ((o.type !== 'user' && o.type !== 'assistant') || o.isMeta || !o.timestamp) continue;
    if (o.uuid) {
      if (seenMsg.has(o.uuid)) continue;
      seenMsg.add(o.uuid);
    }
    const d = new Date(o.timestamp);
    if (isNaN(d)) continue;
    const b = (days[dayKey(d)] ||= { m: 0, s: [], h: {}, mo: {} });
    b.m++;
    b.h[d.getHours()] = (b.h[d.getHours()] || 0) + 1;
    if (o.sessionId && !b.s.includes(o.sessionId)) b.s.push(o.sessionId);

    const msg = o.message;
    if (o.type !== 'assistant' || !msg || !msg.usage || !msg.model || msg.model === '<synthetic>') continue;
    const mm = (b.mo[modelName(msg.model)] ||= [0, 0]);
    mm[1]++;
    // Every line counts, like Claude's own stats screen: one API response spans several
    // lines that repeat the same usage, so this is about 2x the tokens actually billed.
    const u = msg.usage;
    mm[0] += (u.input_tokens || 0) + (u.output_tokens || 0) +
      (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  }
  return days;
}

function summarize(fileSummaries, keys) {
  const want = keys && new Set(keys);
  const sessions = new Set();
  const activeDays = new Set();
  const hours = new Array(24).fill(0);
  const models = {};
  let messages = 0;
  for (const days of fileSummaries) {
    for (const [k, b] of Object.entries(days)) {
      if (want && !want.has(k)) continue;
      if (b.m) activeDays.add(k);
      messages += b.m;
      b.s.forEach(s => sessions.add(s));
      for (const [h, n] of Object.entries(b.h)) hours[h] += n;
      for (const [name, [t, r]] of Object.entries(b.mo)) {
        const x = (models[name] ||= { name, tokens: 0, messages: 0 });
        x.tokens += t;
        x.messages += r;
      }
    }
  }
  const list = Object.values(models).filter(m => m.tokens > 0).sort((a, b) => b.tokens - a.tokens);
  return {
    sessions: sessions.size,
    messages,
    tokens: list.reduce((s, m) => s + m.tokens, 0),
    activeDays: activeDays.size,
    peakHour: messages ? hours.indexOf(Math.max(...hours)) : null,
    favModel: list[0] ? list[0].name : '—',
    models: list,
  };
}

function lastDays(n) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) out.push(dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  return out;
}

(async () => {
  const t0 = Date.now();
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
  const files = listJsonl(ROOT);
  let scanned = 0;
  for (const f of files) {
    const st = fs.statSync(f);
    const c = cache[f];
    if (c && c.v === CACHE_VERSION && c.size === st.size && c.mtime === st.mtimeMs) continue;
    try {
      cache[f] = { v: CACHE_VERSION, size: st.size, mtime: st.mtimeMs, days: await scanFile(f) };
      scanned++;
    } catch (e) { console.error('skip', f, e.message); }
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));

  const summaries = Object.values(cache).map(c => c.days);
  const allDays = {};
  for (const days of summaries) for (const [k, b] of Object.entries(days)) allDays[k] = (allDays[k] || 0) + b.m;
  const data = {
    user: (os.userInfo().username || '').replace(/^./, c => c.toUpperCase()),
    generatedAt: new Date().toISOString(),
    ranges: { all: summarize(summaries), d30: summarize(summaries, lastDays(30)), d7: summarize(summaries, lastDays(7)) },
    days: allDays,
    range30: lastDays(30),
    range7: lastDays(7),
  };
  const tpl = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8');
  const out = path.join(HERE, 'stats.html');
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  fs.writeFileSync(out, tpl.replace('/*DATA*/null', () => json));
  const a = data.ranges.all;
  console.log(`${scanned}/${files.length} fichiers relus en ${((Date.now() - t0) / 1000).toFixed(1)} s — ` +
    `${a.sessions} sessions, ${a.messages} messages, ${a.tokens} tokens, favori ${a.favModel}`);
  if (!process.argv.includes('--no-open')) openFile(out);
})();
