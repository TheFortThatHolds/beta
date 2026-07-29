# AGENTS.md — install Beta Reader for your human

Someone pointed you at this repo and asked you to set it up. This file is the whole job.
You should not need to read `index.html` to do it.

Works with any coding agent — Claude Code, Codex, Cursor, Aider.

---

## What you're building

A listen-and-comment loop for manuscripts:

```
index.html  →  reader link  →  reader listens & talks  →  Worker  →  notes repo
                                                                        │
                                          "Reader notes" ←──────────────┘
                                                 │
                                    consolidated .md → the author's agent
```

Two artifacts: **one static HTML file** and **one Cloudflare Worker**. That's the entire system.

**The person you're installing for uses AI agents.** Don't write them a tutorial, don't offer
a no-server "easy mode", don't ask permission for each step. Install it, verify it, tell them
the one loop they need to know. If something needs their hands — an API key, a token, a
Cloudflare login — say exactly what you need and why, in one line.

**Hard constraints. Do not violate these:**

- **No build step. No package manager. No framework. No dependencies.** `index.html` is served
  as-is by any static host. That's not a limitation to route around, it's the reason this still
  works in five years with nobody maintaining it. If you find yourself adding npm, TypeScript,
  React, or a bundler, you have misread the brief.
- **Never take a raw key or token into your own context.** Run the `wrangler secret put`
  command and let the human paste at the prompt. Never write a key to a file, never echo one
  back, never put one in `config.json` (that file is served to every browser).

---

## Install

### 1. Notes repo

Reader notes need somewhere to land. Ask which repo — or make one, private is fine. You need
`owner/repo`.

### 2. Deploy the Worker

```bash
cd worker
cp wrangler.example.toml wrangler.toml     # gitignored — account-specific values stay local
```

Edit `wrangler.toml`:

```toml
NOTES_REPO      = "owner/notes-repo"
ALLOWED_ORIGINS = "*"                      # tighten in step 5
TTS_API_BASE    = "https://api.openai.com/v1"   # or any OpenAI-compatible speech API
TTS_VOICE       = "alloy"
```

Then:

```bash
npx wrangler deploy
```

Keep the Worker URL it prints.

### 3. Secrets

```bash
npx wrangler secret put TTS_API_KEY     # narration + speech-to-text
npx wrangler secret put GITHUB_TOKEN    # so notes can commit
npx wrangler secret put ACCESS_CODE     # optional; gates the endpoints
```

`GITHUB_TOKEN` must be a **fine-grained** PAT, scoped to the notes repo only, **Contents:
Read and write**. Nothing else. If the human doesn't have one, give them the exact settings
path and wait — don't improvise around it.

### 4. Host the app

Static file, no build command, output directory is the repo root.

```bash
# GitHub Pages: push, then Settings → Pages → Deploy from a branch → main → / (root)
npx wrangler pages deploy . --project-name beta-reader     # Cloudflare Pages
npx netlify deploy --prod --dir .                          # Netlify
```

### 5. Wire it together

```bash
cp config.example.json config.json
```

```json
{
  "title": "Beta Reader",
  "workerUrl": "https://beta-reader.<subdomain>.workers.dev",
  "ttsProvider": "worker",
  "remoteVoice": "alloy"
}
```

Then go back and lock CORS down to the real site origin, and redeploy:

```toml
ALLOWED_ORIGINS = "https://them.github.io"
```

```bash
cd worker && npx wrangler deploy
```

---

## `config.json`

Optional, read at page load, sits next to `index.html`. Every field is optional. Settings the
human changes in-app override it on that device — it's the default, not a lock.

| Field | Meaning |
|---|---|
| `title` / `tagline` | Header text and tab title. |
| `accent` | Any CSS colour. Themes the whole app. |
| `workerUrl` | Worker base URL. No trailing slash. |
| `accessCode` | Only if you set `ACCESS_CODE` on the Worker. |
| `ttsProvider` | `"worker"` or `"webspeech"`. |
| `remoteVoice` | Voice name the speech provider expects. |
| `library` | `[{id, title, author, url}]` — books offered on the library screen. |
| `questions` | `[{section?, q}]` replacing the built-in debrief. `null` keeps the default twenty. |

**Never put a key in here.** It's public to every visitor.

---

## Verify — actually run this

Don't report a checklist you didn't execute.

- [ ] App loads at its final URL; library screen renders.
- [ ] Settings → **Test connection** → `voice ✓ · transcription ✓ · note delivery ✓`.
      An ✗ names the missing env var. `curl https://<worker>/health` says the same in JSON.
- [ ] Add `examples/the-lighthouse-at-kestrel-point.md`, press Play, hear it, watch the active
      passage track.
- [ ] **Add note here** saves; the note appears on the Notes screen.
- [ ] Build a reader link (a book → **Invite a reader**), open it in a private window, confirm
      it loads the manuscript, leave a note, press **Send notes**.
- [ ] Check the notes repo: branch `beta-<name>`, file `reviews/<book-id>.REVIEW.md`.
- [ ] Back in the app: the book → **Reader notes** → the note you just left comes back.
- [ ] `git status` clean of secrets — no `config.json` with a key, no committed
      `wrangler.toml`, no token in history.

---

## The loop to hand back

Close with this and nothing more:

> Put the manuscript at a public URL → **Invite a reader** → send the link.
> They listen and talk. Notes file themselves into `<repo>`, one branch per reader.
> When you want them: the book → **Reader notes** → **Download consolidated .md** → give it
> to your agent.

---

## Reader links

Built in-app (a book → **Invite a reader**), or by hand:

```
https://<host>/?book=<manuscript-url>&title=<title>&author=<author>&id=<book-id>
```

| Param | Required | Notes |
|---|---|---|
| `book` (or `src`) | yes | URL-encoded manuscript URL, publicly fetchable and CORS-readable. |
| `title` | no | Shown on the welcome screen. |
| `author` | no | Shown under the title. |
| `id` | no | The book id notes file under. Defaults to a slug of the title — **keep it stable**, it's the key the author collates on. |

Any URL carrying `book` puts the app in reader mode: name, listen, note, debrief, send. No
library, no settings clutter.

**Manuscript hosting:** the reader's browser fetches the URL directly, so it needs permissive
CORS. `raw.githubusercontent.com` on a public repo works. A private repo does not — the browser
has no credentials. For private manuscripts, serve the file from something the author controls.

---

## Worker API

| Route | Purpose |
|---|---|
| `GET /health` | `{ok, tts, stt, notes}` — capability probe. |
| `POST /tts` | `{text, voice?, speed?, model?}` → `audio/mpeg`. |
| `POST /transcribe` | multipart, field `file` → `{text}`. |
| `POST /notes` | `{reader, bookId, bookTitle, markdown}` → commits, appending to any existing file. |
| `GET /notes?bookId=` | `[{reader, branch, markdown}]` — every reader's file for one book. |
| `GET /readers` | `[{reader, branch, books[]}]` — who has submitted what. |

`ACCESS_CODE`, if set, is required on every route except `/health` via the `X-Access-Code`
header.

---

## Consuming the notes

See [`NOTES_FORMAT.md`](NOTES_FORMAT.md) before you write anything that reads reader notes.
The one rule that matters: **match on the quoted passage, not the passage number.** Indices
shift the moment the manuscript is edited; the quote still finds its place.

---

## Tests

```bash
node test/run.mjs
```

No install, no framework, no network, no browser — it loads the app's `<script>` and the
Worker into a sandbox and exercises the logic that a click-through wouldn't catch: the
manuscript parser, Markdown stripping, sentence chunking, the full export → reparse →
collate round trip (including a reader with two appended sessions), and every Worker route
and guard against a fixtured GitHub API.

**Run it after touching `index.html` or `worker/worker.js`.** A red result is real.

## Modifying the code

- `index.html` is the whole app — HTML, one `<style>`, one `<script>`. Sections carry `══`
  banner comments.
- Plain ES2020 that browsers run directly. No transpiler.
- Screens are `<div class="screen" id="s-name">`; `go('name')` switches.
- Storage: manuscripts in IndexedDB (`beta-reader`/`books`), everything else localStorage under
  the `br.` prefix.
- Playback is a generation-counter loop — `S.gen` increments on every pause, jump, and rate
  change so stale async callbacks can't resurrect old audio. Respect it if you touch playback.
- Two speech engines behind one interface (`speakViaBrowser`, `speakViaWorker`). A third means
  one more case in `speakUnit` and nothing else.
- Collation lives in `parseReview` → `collate` → `renderCollated` / `buildCollatedMarkdown`.
  `parseReview` handles files containing several appended sessions.

**Never commit:** a key, a token, a `config.json` holding one, a personal `wrangler.toml`, a
manuscript that isn't yours, or anyone's real notes. `.gitignore` covers the usual suspects —
check anyway.
