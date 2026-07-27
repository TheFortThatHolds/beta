# Beta Reader

**Hand someone a link. They listen to your manuscript. When something lands — good or bad —
they tap once and say it, and the note is pinned to the exact passage.**

That's the whole idea. Written feedback is slow and vague, so people don't give it. Talking is
fast, so they do. This turns a manuscript into something a friend can listen to on a walk and
talk back at.

One HTML file. No build step, no npm install, no account, no database, no server required.

```
git clone https://github.com/<you>/beta-reader.git
cd beta-reader
open index.html          # macOS   (Linux: xdg-open · Windows: start)
```

That's a working app. Drop in a `.md` or `.txt` file and press Play.

---

## What it does

- **Reads any manuscript aloud** — Markdown or plain text, split into passages, headings
  announced. Uses the voice already built into the browser, so it costs nothing and needs no key.
- **Notes pinned to passages.** Type them, or dictate them and let the browser transcribe.
- **A debrief questionnaire** at the end — twenty craft questions, all editable.
- **Exports a clean Markdown review file** the author (or their AI) can act on directly.
- **Reader links.** Send `?book=<url>` and your reader lands straight in listen-and-comment
  mode. No sign-up, no install, nothing to explain.
- **Resumes where you left off**, per book.
- Light and dark theme. Built for a phone first.

## What it deliberately doesn't do

No accounts. No analytics. No telemetry. No backend. Nothing leaves the browser unless the
reader presses Send on the delivery screen. Manuscripts live in local storage on the device
that opened them.

---

## Two ways to run it

**Zero-config (the default).** The browser's own speech engine narrates, the browser's own
speech recognition handles dictation, and readers deliver notes by downloading a Markdown file
and sending it however they already talk to you. Nothing to deploy, nothing to pay for, nothing
that can break while you aren't looking.

**With a voice server (optional).** If you want better narration, or notes committed straight
into a GitHub repo, deploy the ~200-line Cloudflare Worker in [`worker/`](worker/). Your API key
lives in the Worker's secrets and never reaches the browser. See [SETUP.md](SETUP.md).

You can start on the first and move to the second later. The app doesn't care.

---

## Setting it up with an AI agent

This repo ships with [`AGENTS.md`](AGENTS.md) — a full playbook written for coding agents
(Claude Code, Codex, Cursor, whatever you use). Point your agent at this repo and say:

> Read AGENTS.md and set this up for me.

It will ask what you actually need, pick the simplest configuration that gets you there, write
your `config.json`, deploy the Worker if you want one, and verify it works. Claude Code users
also get a `/setup-beta-reader` skill.

---

## Hosting it

It's one static file — put it anywhere that serves static files:

| Host | How |
|---|---|
| **Nothing at all** | Open `index.html` from disk. Works, minus reader links. |
| **GitHub Pages** | Push, then Settings → Pages → deploy from branch. |
| **Cloudflare Pages / Netlify / Vercel** | Point at the repo. No build command, output = repo root. |
| **Any web server** | Copy `index.html` into the document root. |

Reader links need a real URL (a reader can't open a file on your laptop), so pick a host once
you want to send the link to someone else.

---

## Files

```
index.html               the entire app
config.example.json      optional presets — copy to config.json
worker/worker.js         optional voice + note-delivery server
AGENTS.md                setup playbook for AI agents
SETUP.md                 setup playbook for humans
NOTES_FORMAT.md          the review file format, for anything downstream
examples/                a short public-domain manuscript to try it on
```

---

## License

MIT. Fork it, rename it, sell the setup service, do what you like.

This is released as-is and is not actively maintained — it has no dependencies and no build
step precisely so that it keeps working anyway. If you need it changed, change it; that's what
the license is for.
