/**
 * Beta Reader — optional voice + delivery server.
 *
 * The app works with NO server at all. Deploy this only if you want:
 *   • better-than-browser narration (any OpenAI-compatible /audio/speech API)
 *   • speech-to-text for voice notes (any OpenAI-compatible /audio/transcriptions API)
 *   • readers' notes committed straight into a GitHub repo you own
 *
 * Nothing here is specific to any person, host, book, or brand. Every value comes
 * from environment bindings you set at deploy time. No key is ever committed, and
 * no key is ever sent to the browser.
 *
 * ── Routes ────────────────────────────────────────────────────────────────
 *   GET  /health       → { ok, tts, stt, notes }        capability probe
 *   POST /tts          → audio/mpeg                     { text, voice?, speed?, model? }
 *   POST /transcribe   → { text }                       multipart form, field "file"
 *   POST /notes        → { ok, path, branch }           { reader, bookId, bookTitle, markdown }
 *   GET  /notes?bookId= → [{ reader, markdown }]        every reader's notes for one book
 *   GET  /readers      → [{ reader, books:[…] }]        who has submitted anything
 *
 * ── Environment ───────────────────────────────────────────────────────────
 *   Secrets   (wrangler secret put NAME)
 *     TTS_API_KEY        key for the speech provider          — enables /tts and /transcribe
 *     GITHUB_TOKEN       fine-grained PAT, Contents: R/W      — enables /notes
 *     ACCESS_CODE        optional shared code; if set, callers must send X-Access-Code
 *
 *   Vars      ([vars] in wrangler.toml)
 *     TTS_API_BASE       default https://api.openai.com/v1
 *     TTS_MODEL          default tts-1
 *     TTS_VOICE          default alloy
 *     STT_MODEL          default whisper-1
 *     NOTES_REPO         owner/repo that receives notes      — required for /notes
 *     NOTES_BRANCH_BASE  default main
 *     NOTES_DIR          default reviews
 *     ALLOWED_ORIGINS    comma-separated origins, or *       — default *
 *     MAX_TTS_CHARS      default 2000
 */

const DEFAULTS = {
  TTS_API_BASE: 'https://api.openai.com/v1',
  TTS_MODEL: 'tts-1',
  TTS_VOICE: 'alloy',
  STT_MODEL: 'whisper-1',
  NOTES_BRANCH_BASE: 'main',
  NOTES_DIR: 'reviews',
  ALLOWED_ORIGINS: '*',
  MAX_TTS_CHARS: '2000',
};

const cfg = (env, key) => (env[key] && String(env[key]).trim()) || DEFAULTS[key] || '';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!originAllowed(env, origin)) return json({ error: 'Origin not allowed' }, 403, headers);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/health' || path === '/') {
      return json({
        ok: true,
        tts: !!env.TTS_API_KEY,
        stt: !!env.TTS_API_KEY,
        notes: !!(env.GITHUB_TOKEN && env.NOTES_REPO),
      }, 200, headers);
    }

    if (env.ACCESS_CODE && request.headers.get('X-Access-Code') !== env.ACCESS_CODE) {
      return json({ error: 'Bad or missing access code' }, 401, headers);
    }

    try {
      if (path === '/tts' && request.method === 'POST') return await handleTTS(request, env, headers);
      if (path === '/transcribe' && request.method === 'POST') return await handleSTT(request, env, headers);
      if (path === '/notes' && request.method === 'POST') return await handleNotes(request, env, headers);
      if (path === '/notes' && request.method === 'GET') return await handleCollate(url, env, headers);
      if (path === '/readers' && request.method === 'GET') return await handleReaders(env, headers);
    } catch (err) {
      return json({ error: err.message || 'Server error' }, 500, headers);
    }

    return json({ error: 'Not found' }, 404, headers);
  },
};

// ── /tts ──────────────────────────────────────────────────────────────────
async function handleTTS(request, env, headers) {
  if (!env.TTS_API_KEY) return json({ error: 'No TTS_API_KEY set on this server' }, 501, headers);

  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').trim();
  if (!text) return json({ error: 'Missing text' }, 400, headers);

  const max = parseInt(cfg(env, 'MAX_TTS_CHARS'), 10) || 2000;
  if (text.length > max) return json({ error: `Text too long (${text.length} > ${max})` }, 413, headers);

  const resp = await fetch(cfg(env, 'TTS_API_BASE') + '/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TTS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: body.model || cfg(env, 'TTS_MODEL'),
      voice: body.voice || cfg(env, 'TTS_VOICE'),
      input: text,
      speed: clamp(body.speed, 0.25, 4, 1),
      response_format: 'mp3',
    }),
  });

  if (!resp.ok) return json({ error: 'Speech provider: ' + (await resp.text()).slice(0, 300) }, resp.status, headers);

  return new Response(await resp.arrayBuffer(), {
    headers: { ...headers, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}

// ── /transcribe ───────────────────────────────────────────────────────────
async function handleSTT(request, env, headers) {
  if (!env.TTS_API_KEY) return json({ error: 'No TTS_API_KEY set on this server' }, 501, headers);

  const form = await request.formData();
  const file = form.get('file');
  if (!file) return json({ error: 'Missing file' }, 400, headers);

  const out = new FormData();
  out.append('file', file, file.name || 'note.webm');
  out.append('model', cfg(env, 'STT_MODEL'));

  const resp = await fetch(cfg(env, 'TTS_API_BASE') + '/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TTS_API_KEY}` },
    body: out,
  });

  if (!resp.ok) return json({ error: 'Transcription provider: ' + (await resp.text()).slice(0, 300) }, resp.status, headers);

  const data = await resp.json();
  return json({ text: cleanTranscript(data.text || '') }, 200, headers);
}

/** Whisper likes to hallucinate sign-off boilerplate on near-silent clips. */
function cleanTranscript(t) {
  return String(t)
    .replace(/(?:thanks?\s+for\s+watching|please\s+subscribe|see\s+you\s+next\s+time)[.!]?\s*$/i, '')
    .trim();
}

// ── /notes ────────────────────────────────────────────────────────────────
async function handleNotes(request, env, headers) {
  if (!env.GITHUB_TOKEN || !env.NOTES_REPO) {
    return json({ ok: false, error: 'Note delivery is not configured on this server (GITHUB_TOKEN + NOTES_REPO)' }, 501, headers);
  }

  const body = await request.json().catch(() => ({}));
  const reader = safeSlug(body.reader || 'reader');
  const bookId = safeSlug(body.bookId || 'book');
  const markdown = String(body.markdown || '');
  if (!markdown.trim()) return json({ ok: false, error: 'Missing markdown' }, 400, headers);

  const repo = env.NOTES_REPO;
  const branch = `beta-${reader}`;
  const filePath = `${cfg(env, 'NOTES_DIR')}/${bookId}.REVIEW.md`;
  const gh = (p, o) => ghApi(env.GITHUB_TOKEN, p, o);

  // one branch per reader, forked from the base branch on first submission
  try {
    await gh(`repos/${repo}/branches/${branch}`);
  } catch (_) {
    const base = await gh(`repos/${repo}/branches/${cfg(env, 'NOTES_BRANCH_BASE')}`);
    await gh(`repos/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.commit.sha }),
    });
  }

  // repeat sessions append below the existing file rather than replacing it
  let sha = null, existing = '';
  try {
    const f = await gh(`repos/${repo}/contents/${filePath}?ref=${branch}`);
    sha = f.sha;
    existing = b64decode(f.content) + '\n\n';
  } catch (_) { /* first submission for this book */ }

  const payload = {
    message: `beta notes: ${bookId} — ${reader}`,
    content: b64encode(existing + markdown),
    branch,
  };
  if (sha) payload.sha = sha;

  await gh(`repos/${repo}/contents/${filePath}`, { method: 'PUT', body: JSON.stringify(payload) });
  return json({ ok: true, branch, path: filePath }, 200, headers);
}

// ── GET /notes?bookId= — pull every reader's file for one book ────────────
async function handleCollate(url, env, headers) {
  if (!env.GITHUB_TOKEN || !env.NOTES_REPO) {
    return json({ error: 'Note storage is not configured on this server (GITHUB_TOKEN + NOTES_REPO)' }, 501, headers);
  }
  const bookId = safeSlug(url.searchParams.get('bookId') || '');
  if (!bookId || bookId === 'x') return json({ error: 'Missing bookId' }, 400, headers);

  const repo = env.NOTES_REPO;
  const dir = cfg(env, 'NOTES_DIR');
  const gh = p => ghApi(env.GITHUB_TOKEN, p);

  const branches = await gh(`repos/${repo}/branches?per_page=100`);
  const readerBranches = branches.filter(b => b.name.startsWith('beta-'));

  const results = await Promise.all(readerBranches.map(async b => {
    try {
      const f = await gh(`repos/${repo}/contents/${dir}/${bookId}.REVIEW.md?ref=${b.name}`);
      return { reader: b.name.slice(5), branch: b.name, markdown: b64decode(f.content) };
    } catch (_) {
      return null;   // this reader has not submitted on this book
    }
  }));

  return json(results.filter(Boolean), 200, { ...headers, 'Cache-Control': 'no-store' });
}

// ── GET /readers — who exists, and what they have submitted ───────────────
async function handleReaders(env, headers) {
  if (!env.GITHUB_TOKEN || !env.NOTES_REPO) {
    return json({ error: 'Note storage is not configured on this server (GITHUB_TOKEN + NOTES_REPO)' }, 501, headers);
  }
  const repo = env.NOTES_REPO;
  const dir = cfg(env, 'NOTES_DIR');
  const gh = p => ghApi(env.GITHUB_TOKEN, p);

  const branches = await gh(`repos/${repo}/branches?per_page=100`);
  const out = await Promise.all(
    branches.filter(b => b.name.startsWith('beta-')).map(async b => {
      let books = [];
      try {
        const listing = await gh(`repos/${repo}/contents/${dir}?ref=${b.name}`);
        books = (Array.isArray(listing) ? listing : [])
          .filter(f => f.name.endsWith('.REVIEW.md'))
          .map(f => f.name.replace(/\.REVIEW\.md$/, ''));
      } catch (_) { /* no reviews dir on this branch yet */ }
      return { reader: b.name.slice(5), branch: b.name, books };
    })
  );

  return json(out, 200, { ...headers, 'Cache-Control': 'no-store' });
}

async function ghApi(token, path, { method = 'GET', body = null } = {}) {
  const resp = await fetch('https://api.github.com/' + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'beta-reader-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body || undefined,
  });
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(`GitHub ${resp.status}: ${e.message || path}`);
  }
  return resp.json();
}

// ── helpers ───────────────────────────────────────────────────────────────
function originAllowed(env, origin) {
  const list = cfg(env, 'ALLOWED_ORIGINS');
  if (list === '*' || !origin) return true;
  return list.split(',').map(s => s.trim()).filter(Boolean).includes(origin);
}

function cors(env, origin) {
  const list = cfg(env, 'ALLOWED_ORIGINS');
  const allow = list === '*' ? '*' : (originAllowed(env, origin) ? origin : '');
  return {
    'Access-Control-Allow-Origin': allow || 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

const clamp = (v, lo, hi, dflt) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

const safeSlug = s =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'x';

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
