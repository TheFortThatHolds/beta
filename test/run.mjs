/**
 * Beta Reader — test suite.
 *
 *   node test/run.mjs
 *
 * No dependencies, no test framework, no config. Same rule as the rest of the
 * repo: if it needed an install step it would rot.
 *
 * Covers the pure logic that has to be right and that a browser click-through
 * would not catch:
 *   • the manuscript parser (headings, fences, comments, rules, paragraph joins)
 *   • Markdown stripping and sentence chunking
 *   • the export → reparse → collate round trip, including a reader with two
 *     appended sessions (the case where "2 notes" must NOT read as "2 readers")
 *   • every Worker route and guard, against a fixtured GitHub API
 *
 * Run it after touching index.html or worker/worker.js. If it goes red, the
 * failure is real — none of this depends on network, keys, or a browser.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const results = [];

function ok(name, cond, detail) {
  if (cond) { pass++; results.push(`  ✓ ${name}`); }
  else { fail++; results.push(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}
const eq = (name, actual, expected) =>
  ok(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

function section(title) { results.push(`\n${title}`); }

// ── load index.html's <script> into a sandbox with just enough browser ──────
function loadApp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<script>\n([\s\S]*)<\/script>/);
  if (!m) throw new Error('could not find the app <script> block in index.html');

  const store = {};
  const stub = () => ({
    textContent: '', innerHTML: '', value: '', style: {}, className: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, scrollIntoView() {}, focus() {}, select() {},
    getAttribute() { return null; }, setAttribute() {},
  });
  const document = {
    getElementById: () => stub(), querySelectorAll: () => [], createElement: () => stub(),
    documentElement: { style: { setProperty() {} }, removeAttribute() {}, setAttribute() {} },
    body: { appendChild() {}, className: '' }, addEventListener() {}, title: '',
  };
  const window = { addEventListener() {}, location: { search: '', origin: 'http://test', pathname: '/' } };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };

  const exported = [
    'parseManuscript', 'clean', 'chunkText', 'slug', 'esc',
    'buildMarkdown', 'buildJSON', 'parseReview', 'collate',
    'buildCollatedMarkdown', 'distinctReaders', 'S',
  ];
  const factory = new Function(
    'document', 'window', 'localStorage', 'navigator', 'location', 'fetch',
    'setInterval', 'indexedDB', 'URLSearchParams', 'Blob', 'URL',
    `${m[1]}\n;return { ${exported.join(', ')}, __store: null, setCollated: v => { COLLATED = v; } };`
  );

  const api = factory(
    document, window, localStorage, { language: 'en-US' }, window.location,
    async () => { throw new Error('no network in tests'); },
    () => 0, undefined, URLSearchParams, class Blob {}, URL
  );
  api.__store = store;
  return api;
}

// ── load worker.js as a module without its default export ──────────────────
async function loadWorker() {
  const src = fs.readFileSync(path.join(ROOT, 'worker', 'worker.js'), 'utf8')
    .replace('export default {', 'const HANDLER = {')
    + '\nexport { HANDLER, b64encode, b64decode, safeSlug, clamp, originAllowed, cors, cleanTranscript };';
  const tmp = path.join(ROOT, 'test', '.worker.tmp.mjs');
  fs.writeFileSync(tmp, src);
  try { return await import('file://' + tmp + '?t=' + process.hrtime.bigint()); }
  finally { fs.unlinkSync(tmp); }
}

// ═══════════════════════════════════════════════════════════════════════════
const app = loadApp();
const sample = fs.readFileSync(path.join(ROOT, 'examples', 'the-lighthouse-at-kestrel-point.md'), 'utf8');

section('Manuscript parsing');
{
  const units = app.parseManuscript(sample);
  ok('sample yields units', units.length > 20, `got ${units.length}`);
  ok('headings become their own units', units.filter(u => u.type === 'h').length === 4);
  ok('first unit is the title heading', units[0].type === 'h' && /Lighthouse/.test(units[0].text));
  ok('no horizontal rule leaks in', !units.some(u => /^-{3,}$/.test(u.text)));
  ok('no HTML comment leaks in', !units.some(u => u.text.startsWith('<!--')));
  ok('multi-line paragraphs join into one unit',
     (units.find(u => u.text.startsWith('She knew this')) || {}).text?.length > 300);

  const tricky = app.parseManuscript([
    '# Title', '', '<!-- provenance: gate=x -->', '', 'Line one', 'still line one.',
    '', '---', '', '```', 'code that must not be read aloud', '```', '', '## Two', '', 'Tail.',
  ].join('\n'));
  eq('comment + rule + fence all dropped', tricky.length, 4);
  eq('wrapped lines joined with a space', tricky[1].text, 'Line one still line one.');
  ok('fenced code excluded', !tricky.some(u => /read aloud/.test(u.text)));
}

section('Markdown stripping and chunking');
{
  eq('decoration stripped', app.clean('**bold** _it_ `c` [x](y)'), 'bold it c x');
  eq('images dropped', app.clean('a ![alt](i.png) b'), 'a b');
  eq('whitespace collapsed', app.clean('a   \n  b'), 'a b');

  const long = 'One sentence here. Two sentences here! Three? '.repeat(12);
  const chunks = app.chunkText(long, 220);
  ok('splits long text', chunks.length > 1, `got ${chunks.length}`);
  ok('respects the cap', Math.max(...chunks.map(c => c.length)) <= 220);
  eq('chunking is lossless',
     chunks.join(' ').replace(/\s+/g, ' ').trim(), long.replace(/\s+/g, ' ').trim());
  eq('short text stays whole', app.chunkText('Hi.', 220).length, 1);

  eq('slug normalises', app.slug('The Lighthouse at Kestrel Point'), 'the-lighthouse-at-kestrel-point');
  ok('slug never returns empty', app.slug('!!!').length > 0);
  eq('esc blocks markup', app.esc('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
}

section('Export → reparse → collate round trip');
{
  const units = app.parseManuscript(sample);
  const review = (name, notes, answers) => {
    app.S.book = { id: 'lighthouse', title: 'The Lighthouse at Kestrel Point' };
    app.S.units = units; app.S.notes = {}; app.S.answers = answers || {};
    for (const [i, text] of Object.entries(notes)) {
      app.S.notes[i] = { text, quote: units[i].text, at: '2026-07-27T00:00:00Z' };
    }
    app.__store['br.settings'] = JSON.stringify({ name });
    return app.buildMarkdown();
  };

  const sam1 = review('sam', { 3: 'This is where I sat up.', 10: 'The counting detail earns it.' },
                      { 0: 'Not at all, and I mean that well.', 5: 'The boat shed dragged.' });
  const jordan = review('jordan', { 3: 'Same — the lamp line is the hook.', 22: 'Ruth arriving felt abrupt.' },
                        { 5: 'Yes, the middle third.' });
  // the Worker APPENDS on a repeat session, so one file can hold several reviews
  const sam = sam1 + '\n\n' + review('sam', { 10: 'Second pass: still my favourite line.' }, {});

  ok('export has the header block', /^# Beta Review: .+\nReader: .+\nBook: .+\nSession: \d{4}-\d{2}-\d{2}/.test(sam1));
  ok('export quotes the passage', /^> The lamp had gone out/m.test(sam1));
  ok('debrief section present', sam1.includes('## Debrief'));
  JSON.parse(app.buildJSON());
  ok('JSON export parses', true);

  const parsed = app.parseReview(sam, 'sam');
  eq('appended sessions both parsed', parsed.length, 2);
  eq('all notes recovered', parsed.flatMap(s => s.notes).length, 3);
  ok('quote survives the round trip', parsed[0].notes[0].quote.startsWith('The lamp had gone out'));
  eq('debrief answer recovered', parsed[0].debrief[1].a, 'The boat shed dragged.');
  eq('debrief section recovered', parsed[0].debrief[1].section, 'Pacing and structure');

  const c = app.collate([{ reader: 'sam', markdown: sam }, { reader: 'jordan', markdown: jordan }]);
  eq('both readers found', c.readers.join(','), 'sam,jordan');
  eq('passages sorted ascending', c.passages.map(p => p.passage).join(','), '4,11,23');

  const p4 = c.passages.find(p => p.passage === 4);
  const p11 = c.passages.find(p => p.passage === 11);
  eq('shared passage counts two readers', app.distinctReaders(p4), 2);
  eq('same reader twice is NOT two readers', app.distinctReaders(p11), 1);
  eq('...but both of their notes are kept', p11.notes.length, 2);

  const shared = c.questions.find(q => q.answers.length > 1);
  ok('a question answered by both is grouped', !!shared);
  eq('grouped question has both answers', shared.answers.length, 2);

  app.setCollated(c);
  const out = app.buildCollatedMarkdown();
  ok('consensus flagged up top', /drew notes from more than one reader: 4\./.test(out));
  ok('shared passage labelled', /## Passage 4 — 2 readers/.test(out));
  ok('same-reader passage not mislabelled', /## Passage 11\n/.test(out));
  ok('both readers attributed under passage 4',
     /## Passage 4[\s\S]*?\*\*sam:\*\*[\s\S]*?\*\*jordan:\*\*/.test(out));
}

// ═══════════════════════════════════════════════════════════════════════════
section('Worker helpers');
const w = await loadWorker();
{
  const s = '# Beta Review: Café — “smart quotes” ✓\nnaïve';
  eq('base64 survives UTF-8', w.b64decode(w.b64encode(s)), s);
  eq('reader names slug safely', w.safeSlug("Sam O'Brien!"), 'sam-o-brien');
  ok('slug never empty', w.safeSlug('!!!').length > 0);
  eq('speed clamps high', w.clamp(9, 0.25, 4, 1), 4);
  eq('speed falls back', w.clamp(undefined, 0.25, 4, 1), 1);
  eq('whisper boilerplate stripped', w.cleanTranscript('ok. Thanks for watching!'), 'ok.');
  ok('wildcard origin allows', w.originAllowed({}, 'https://anything'));
  ok('listed origin allows', w.originAllowed({ ALLOWED_ORIGINS: 'https://a, https://b' }, 'https://b'));
  ok('unlisted origin denied', !w.originAllowed({ ALLOWED_ORIGINS: 'https://a' }, 'https://evil'));
  eq('denied origin gets no ACAO',
     w.cors({ ALLOWED_ORIGINS: 'https://a' }, 'https://evil')['Access-Control-Allow-Origin'], 'null');
}

section('Worker routes');
{
  const req = (p, o) => new Request('https://worker' + p, o);
  const body = async r => r.text();

  let r = await w.HANDLER.fetch(req('/health'), {});
  eq('/health on a bare deploy', await body(r), '{"ok":true,"tts":false,"stt":false,"notes":false}');

  r = await w.HANDLER.fetch(req('/health'), { TTS_API_KEY: 'k', GITHUB_TOKEN: 't', NOTES_REPO: 'o/r' });
  eq('/health fully configured', await body(r), '{"ok":true,"tts":true,"stt":true,"notes":true}');

  r = await w.HANDLER.fetch(req('/tts', { method: 'POST', body: '{"text":"hi"}' }), {});
  eq('/tts without a key is 501', r.status, 501);

  r = await w.HANDLER.fetch(req('/tts', { method: 'POST', body: '{"text":"hi"}' }), { ACCESS_CODE: 'x' });
  eq('wrong access code is 401', r.status, 401);

  r = await w.HANDLER.fetch(req('/health'), { ACCESS_CODE: 'x' });
  eq('/health stays open under an access code', r.status, 200);

  r = await w.HANDLER.fetch(req('/health', { headers: { Origin: 'https://evil' } }), { ALLOWED_ORIGINS: 'https://ok' });
  eq('disallowed origin is 403', r.status, 403);

  r = await w.HANDLER.fetch(req('/tts', { method: 'OPTIONS' }), {});
  eq('preflight is 204', r.status, 204);
  eq('preflight advertises the code header',
     r.headers.get('Access-Control-Allow-Headers'), 'Content-Type, X-Access-Code');

  r = await w.HANDLER.fetch(req('/nope', { method: 'POST' }), {});
  eq('unknown route is 404', r.status, 404);

  r = await w.HANDLER.fetch(req('/tts', { method: 'POST', body: JSON.stringify({ text: 'x'.repeat(5000) }) }),
                            { TTS_API_KEY: 'k' });
  eq('over-long TTS input is 413', r.status, 413);
}

section('Worker ↔ GitHub (fixtured)');
{
  const enc = s => Buffer.from(s, 'utf8').toString('base64');
  const fixture = {
    'repos/o/r/branches?per_page=100': [{ name: 'main' }, { name: 'beta-sam' }, { name: 'beta-jordan' }],
    'repos/o/r/contents/reviews/bk.REVIEW.md?ref=beta-sam': { content: enc('# Beta Review: Bk\nReader: sam\n') },
    'repos/o/r/contents/reviews?ref=beta-sam': [{ name: 'bk.REVIEW.md' }, { name: 'x.REVIEW.md' }, { name: 'README.md' }],
    'repos/o/r/contents/reviews?ref=beta-jordan': [],
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async u => {
    const p = String(u).replace('https://api.github.com/', '');
    return p in fixture
      ? new Response(JSON.stringify(fixture[p]), { status: 200 })
      : new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  };

  const env = { GITHUB_TOKEN: 't', NOTES_REPO: 'o/r' };
  try {
    let r = await w.HANDLER.fetch(new Request('https://worker/notes?bookId=bk'), env);
    let j = await r.json();
    eq('GET /notes returns only readers who submitted', j.length, 1);
    eq('GET /notes attributes the reader', j[0].reader, 'sam');
    ok('GET /notes decodes the file', j[0].markdown.includes('Reader: sam'));

    r = await w.HANDLER.fetch(new Request('https://worker/readers'), env);
    j = await r.json();
    eq('GET /readers lists reader branches only', j.length, 2);
    eq('GET /readers lists their books', j[0].books.join(','), 'bk,x');
    eq('GET /readers tolerates an empty branch', j[1].books.length, 0);

    r = await w.HANDLER.fetch(new Request('https://worker/notes?bookId=bk'), {});
    eq('GET /notes unconfigured is 501', r.status, 501);

    r = await w.HANDLER.fetch(new Request('https://worker/notes'), env);
    eq('GET /notes without a bookId is 400', r.status, 400);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
