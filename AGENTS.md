# AGENTS.md — setting up Beta Reader for your human

You are reading this because someone pointed you at this repo and asked you to set it up.
This file is the whole playbook. You should not need to read `index.html` to do the job.

Works with any coding agent — Claude Code, Codex, Cursor, Aider, whatever you are.

---

## What this thing is

A single-file web app that reads a manuscript aloud and lets a listener pin spoken or typed
notes to the exact passage they're reacting to. It exports a Markdown review file.

**The most important fact: it already works.** `index.html` with no configuration at all is a
functioning app. Your job is not to make it run — it runs. Your job is to find out which of
three or four small upgrades this particular person actually needs, and do only those.

**Do not add a build step. Do not add dependencies. Do not add a framework.** The no-build,
no-dependency shape is the feature — it's what lets this keep working years from now with
nobody maintaining it. If you're tempted to introduce npm, TypeScript, React, or a bundler,
you've misread the brief.

---

## Step 1 — Ask, don't assume

Ask these, one at a time, in this order. Stop as soon as you have enough. Most people need
only the first two.

1. **"Do you want to send this to other people, or is it just for you?"**
   - Just them → they can open `index.html` from disk. You may be done already.
   - Other people → they need it hosted. Go to Step 2.

2. **"Is the built-in browser voice good enough, or do you want better narration?"**
   - Good enough → no server, no key, no cost. Strongly prefer this. Say so.
   - Wants better → they'll need an API key and a deployed Worker. Go to Step 3.
   - **Default to the browser voice.** It's free, private, and can't break. Only escalate if
     they've heard it and specifically don't like it.

3. **"When a reader finishes, how do you want their notes to reach you?"**
   - A downloaded file they email back → nothing to build. This is the default.
   - Committed automatically into a GitHub repo → they need the Worker plus a GitHub token.

4. **"Do you have specific books to load, or will you add them by hand each time?"**
   - Specific books at stable URLs → put them in `config.json` so they appear on the library
     screen automatically.

Now go do only what those answers require.

---

## Step 2 — Hosting

One static file, no build. Pick whichever the person already uses.

**GitHub Pages** (simplest if the repo is already on GitHub):
```bash
git push
# then: repo → Settings → Pages → Source: Deploy from a branch → main → / (root)
```
Site lands at `https://<user>.github.io/<repo>/`.

**Cloudflare Pages:**
```bash
npx wrangler pages deploy . --project-name beta-reader
```

**Netlify:**
```bash
npx netlify deploy --prod --dir .
```

**Local only:** `open index.html`. Everything works except reader links (a reader can't open a
file on someone else's laptop).

Verify by loading the URL and confirming the library screen renders.

---

## Step 3 — `config.json` (optional presets)

If `config.json` sits next to `index.html`, the app reads it at load. It's the clean way to
preset things so the person doesn't have to touch the Settings screen. Copy
`config.example.json` and edit. **Every field is optional.**

```json
{
  "title": "Beta Reader",
  "tagline": "Listen to a manuscript. Talk back at the exact line.",
  "accent": "#6d3bd6",

  "workerUrl": "",
  "accessCode": "",
  "ttsProvider": "webspeech",
  "remoteVoice": "alloy",

  "library": [
    { "id": "book-one", "title": "Book One", "author": "A. Writer",
      "url": "https://example.com/book-one.md" }
  ],

  "questions": null
}
```

| Field | Meaning |
|---|---|
| `title` / `tagline` | Header text and browser tab title. |
| `accent` | Any CSS colour. Themes the whole app. |
| `workerUrl` | Voice server base URL. Empty = browser voice. No trailing slash. |
| `accessCode` | Only if the Worker was deployed with `ACCESS_CODE` set. |
| `ttsProvider` | `"webspeech"` or `"worker"`. |
| `remoteVoice` | Voice name the speech provider expects, e.g. `alloy`, `nova`. |
| `library` | Books offered on the library screen. `url` must be publicly fetchable and CORS-readable. |
| `questions` | Replaces the built-in debrief set. `[{ "section": "...", "q": "..." }, ...]` — `section` starts a new group, `q` is the question. `null` keeps the built-in twenty. |

Settings a person changes in the app override `config.json` on that device. `config.json` is
the default, not a lock.

**Note on manuscript URLs:** the browser fetches them directly, so the host must send
permissive CORS headers. `raw.githubusercontent.com` on a public repo works. A private repo
does not — for private manuscripts, either host the file behind a URL they control or have
them add books by file upload.

---

## Step 4 — The Worker (only if Step 1 said so)

Skip this entirely unless they want better narration, transcription, or auto-committed notes.

```bash
cd worker
cp wrangler.example.toml wrangler.toml     # gitignored — safe for account-specific values
npx wrangler deploy
```

Then set secrets. **You set these by running the commands so the human can paste the value into
the prompt — never take a raw key into your own context, never write one into a file, never put
one in `config.json` or `wrangler.toml`.**

```bash
npx wrangler secret put TTS_API_KEY      # enables /tts and /transcribe
npx wrangler secret put GITHUB_TOKEN     # only if notes should commit to a repo
npx wrangler secret put ACCESS_CODE      # optional shared code to gate the endpoints
```

`GITHUB_TOKEN` should be a **fine-grained** personal access token scoped to exactly the one
notes repo, with **Contents: Read and write**. Nothing else.

Non-secret settings go in `wrangler.toml` under `[vars]` — see `wrangler.example.toml` for the
full annotated list. The ones that matter:

- `NOTES_REPO` — `owner/repo` that receives notes. Blank disables `/notes`.
- `ALLOWED_ORIGINS` — set this to the exact site origin once hosting is settled. Leave `*`
  only while testing.
- `TTS_API_BASE` — any OpenAI-compatible speech API, not just OpenAI's.

Finally, wire the app to it: set `workerUrl` and `"ttsProvider": "worker"` in `config.json`, or
have the person enter it in Settings → Voice server URL.

**Verify:** open the app → Settings → Test connection. It reports three capabilities:

```
Connected — voice ✓ · transcription ✓ · note delivery ✓
```

An ✗ means that env var isn't set. `curl https://<worker>/health` returns the same as JSON.

---

## Step 5 — Verify, honestly

Before you tell them it's done, actually check:

- [ ] The app loads at its final URL and the library screen renders.
- [ ] A manuscript can be added (file, URL, or paste) and appears in the library.
- [ ] Play speaks, and the active passage highlights and scrolls.
- [ ] "Add note here" saves a note, and the note shows on the Notes screen.
- [ ] Download `.md` produces a review file with the notes in it.
- [ ] If a Worker was deployed: Test connection reports what you expect.
- [ ] If a reader link was built: open it in a private window and confirm it reaches the
      welcome screen and loads the manuscript.
- [ ] `git status` is clean of secrets — no `config.json` with a key, no `wrangler.toml`
      committed, no token in history.

If something doesn't work, say so plainly and fix it. Don't report a green checklist you
didn't run.

---

## Reader links

The author builds these in the app: library → a book → **Invite a reader**. Or construct one
directly:

```
https://<host>/index.html?book=<manuscript-url>&title=<title>&author=<author>&id=<book-id>
```

| Param | Required | Notes |
|---|---|---|
| `book` (or `src`) | yes | URL-encoded manuscript URL. Must be CORS-readable. |
| `title` | no | Shown on the welcome screen. |
| `author` | no | Shown under the title. |
| `id` | no | Stable id used in the exported filename. Derived from the title if omitted. |

Any URL with `book` set puts the app in **reader mode**: no library, no settings clutter —
name, listen, note, debrief, send.

---

## The review file

Documented in [`NOTES_FORMAT.md`](NOTES_FORMAT.md). Read that before writing anything that
consumes reader notes. Short version: a `#` header block with `Reader:` / `Book:` / `Session:`,
then `## Note N — Passage M` sections each carrying a `>` quote of the passage and the note
body, then an optional `## Debrief`.

Passage numbers are 1-based indices into the parsed unit list (headings count as units), not
line numbers, not chapter numbers. To map a note back to the manuscript, parse the file the
same way the app does — split on blank lines, treat `#` lines as their own unit, skip fenced
code blocks, `<!-- -->` comment lines, and horizontal rules. The `>` quote in each note is the
reliable anchor; use it, and treat the number as a hint.

---

## Working on the code itself

If you're modifying rather than deploying:

- `index.html` is the entire app. HTML, then CSS in one `<style>`, then JS in one `<script>`.
  Sections are marked with `══` banner comments.
- No dependencies, no build, no bundler, no transpiler. Plain ES2020 that browsers run directly.
- Screens are `<div class="screen" id="s-name">`; `go('name')` switches between them.
- Persistence: manuscripts in IndexedDB (`beta-reader` / `books`), everything else in
  localStorage under the `br.` prefix.
- Playback is a generation-counter loop — `S.gen` increments on every pause, jump, or rate
  change so stale async callbacks can't resurrect old audio. If you touch playback, respect it.
- Two speech engines behind one interface: `speakViaBrowser` and `speakViaWorker`. Adding a
  third means adding a case to `speakUnit`, nothing more.

**Never commit:** an API key, a token, a `config.json` containing one, a personal `wrangler.toml`,
a manuscript you don't own, or anyone's real notes. `.gitignore` covers the usual ones — check
anyway before you push. This is a public repo shape; treat it as one.
