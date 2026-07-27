# Beta Reader

**Hand someone a link. They listen to your book. When something lands — good or bad —
they tap once and say it, and the note is pinned to the exact passage. It files itself into
your repo. You pull every reader's notes into one passage-by-passage view and hand that to
your agent.**

That's the loop. Written feedback is slow and vague so people don't give it; talking is fast
so they do.

## This is an agent-installed tool

There's no wizard and no hosted signup. You point a coding agent at this repo and it stands
the whole thing up — static app, Cloudflare Worker, secrets, notes repo, reader links:

> Read AGENTS.md and set this up for me.

[`AGENTS.md`](AGENTS.md) is the complete playbook and it's provider-neutral — Claude Code,
Codex, Cursor, whatever you run. Claude Code users get two skills for free:

- **`/setup-beta-reader`** — installs and verifies the whole thing.
- **`/beta-feedback`** — pulls every reader's notes and tells you what they actually said.

If you don't run an agent, the commands are all in `AGENTS.md` and it's about ten minutes by
hand. But that's not who this is for.

---

## The shape

```
index.html          one static file, no build, no deps, no framework
      │
      │  reader link: ?book=<manuscript-url>
      ▼
 your reader        listens · taps · talks · answers the debrief · sends
      │
      ▼
worker/worker.js    your Cloudflare Worker — your key, your repo, your rules
      │
      ▼
 notes repo         one branch per reader · reviews/<book-id>.REVIEW.md
      │
      ▼
   you              "Reader notes" → every reader, grouped by passage → your agent
```

Two moving parts. One HTML file and one Worker. Nothing else to run, nothing to keep updated.

## What it does

- **Reads the manuscript aloud** — Markdown or plain text, split into passages, headings
  announced, resumes where you left off.
- **Notes pinned to passages** — typed or spoken. Speech-to-text through your Worker, or the
  browser's own dictation.
- **A twenty-question debrief** at the end. Fully replaceable in `config.json`.
- **Files itself.** Notes commit to a branch per reader. Repeat sessions append. Readers never
  see each other's notes and never conflict.
- **Collation is the point.** The author side pulls every reader's file and groups it by
  passage — passages more than one reader hit are flagged, because that's where the signal is.
  Export the consolidated Markdown and hand it straight to your agent.

## What it won't do

No accounts, no analytics, no telemetry, no database, no build step, no dependencies. Your API
key lives in your Worker's secrets and never touches a browser. Manuscripts stay in local
storage on the device that opened them.

---

## Voices

Narration goes through your Worker to any OpenAI-compatible speech API — point `TTS_API_BASE`
wherever you like. The browser's built-in speech engine is also selectable if you'd rather not
pay per character; it's rougher but it's free and it needs no key.

---

## Files

```
index.html                      the entire app — reader side and author side
config.example.json             presets: title, accent, worker URL, library, questions
worker/worker.js                TTS · speech-to-text · notes in, notes out
AGENTS.md                       the setup playbook
NOTES_FORMAT.md                 the review + consolidated file formats
.claude/skills/                 /setup-beta-reader · /beta-feedback
examples/                       a sample manuscript to test on
```

## License

MIT. Fork it, rename it, sell the setup service, do what you like.

Released as-is and not actively maintained — which is exactly why it has no dependencies and
no build step. Nothing here rots. If you need it changed, change it.
