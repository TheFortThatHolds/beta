---
name: setup-beta-reader
description: Set up the Beta Reader app for whoever is running this session — host it, configure it, optionally deploy the voice/notes Worker, and verify it works end to end. Use when someone says "set up the beta reader", "get this running", "deploy this", "help me send this to a reader", or opens this repo not knowing what to do with it.
---

# /setup-beta-reader

Set up this app for the person in front of you. `AGENTS.md` in the repo root is the full
playbook — **read it first**, then follow the flow below.

## The one thing to get right

The app already works with zero configuration. Opening `index.html` is a functioning
beta reader. Your job is to find the smallest set of additions this person actually needs
and do only those — not to build them a stack.

Never add a build step, a package manager, or a framework. The no-dependency shape is the
product.

## Flow

1. **Read `AGENTS.md`.** Everything below assumes it.

2. **Ask what they need — one question at a time, not a list.** Start with:
   *"Is this just for you, or are you sending it to other people to read?"*
   Their answer decides whether hosting is even in scope. Then ask about voice quality,
   then about how notes should come back. Stop asking as soon as you have enough.

3. **Do the minimum that answers those.** In practice that's usually:
   - host the static file (GitHub Pages / Cloudflare Pages / Netlify), and
   - write a `config.json` from `config.example.json`.

4. **Only deploy the Worker if they asked for better narration, transcription, or
   auto-committed notes.** If you do:
   - `cd worker && cp wrangler.example.toml wrangler.toml && npx wrangler deploy`
   - Run `npx wrangler secret put TTS_API_KEY` and let *them* paste the key at the prompt.
     Do not take a raw key into your context, do not write one to a file, do not echo one back.
   - Set `NOTES_REPO` and `ALLOWED_ORIGINS` in `wrangler.toml`, then redeploy.

5. **Verify against the checklist in `AGENTS.md` Step 5, and actually run it.** Load the app,
   add the sample manuscript from `examples/`, press Play, save a note, download the `.md`.
   Report what you observed. If something failed, say so and fix it — do not report a
   checklist you didn't execute.

6. **Sweep before you push.** No key in `config.json`, no committed `wrangler.toml`, no
   manuscript or reader notes that aren't theirs to publish.

## Then hand them the loop

Close by telling them, in two lines, how they actually use it:

> Put your manuscript somewhere with a public URL → in the app, pick the book →
> **Invite a reader** → send the link. They listen, they talk, you get a Markdown file
> with every note pinned to its passage.

If they want notes applied back to the manuscript afterwards, read `NOTES_FORMAT.md` — it
documents the file and, importantly, says to match on the **quoted passage** rather than
trusting the passage number, since indices shift the moment the manuscript is edited.
