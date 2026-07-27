---
name: setup-beta-reader
description: Install Beta Reader end to end — deploy the Worker, wire the notes repo, host the app, and verify the whole loop with a real reader link. Use when someone says "set up the beta reader", "install this", "deploy this", "get this running", or opens this repo wanting it working.
---

# /setup-beta-reader

Install this for the person running the session. `AGENTS.md` in the repo root is the full
playbook — **read it first**, then work the steps below.

## Posture

They use agents. Don't tutorialise, don't offer an easy mode, don't ask permission per step.
Install it, verify it, hand back the one loop. Ask only for the things you genuinely cannot do
yourself: which notes repo, an API key, a GitHub token, a Cloudflare login.

## Hard rules

- **No build step, no package manager, no framework, no dependencies.** That shape is the
  product — it's why this still runs years from now unmaintained.
- **Never take a raw key into your context.** Run the `wrangler secret put` command and let
  them paste at the prompt. Never write a key to a file, never echo one back, never put one in
  `config.json` — that file is served to every visitor.

## Steps

1. **Notes repo.** Ask which one, or offer to create it. Private is fine. You need `owner/repo`.

2. **Worker.**
   ```bash
   cd worker && cp wrangler.example.toml wrangler.toml
   ```
   Set `NOTES_REPO`, `TTS_API_BASE`, `TTS_VOICE` in `[vars]`, then `npx wrangler deploy`.
   Keep the URL.

3. **Secrets.** `TTS_API_KEY` (narration + speech-to-text), `GITHUB_TOKEN` (fine-grained PAT,
   that repo only, Contents: Read and write), optionally `ACCESS_CODE`.

4. **Host** the static file — GitHub Pages, Cloudflare Pages, or Netlify. No build command,
   root is the site.

5. **Wire it:** `cp config.example.json config.json`, set `workerUrl` and
   `"ttsProvider": "worker"`. Then tighten `ALLOWED_ORIGINS` in `wrangler.toml` to the real
   site origin and redeploy.

6. **Verify — run the checklist in AGENTS.md, don't just read it.** The one that proves the
   whole system: build a reader link, open it in a private window, leave a note, send it,
   confirm the branch and file appeared in the notes repo, then pull it back through
   **Reader notes** in the app. If any step fails, say so and fix it.

7. **Sweep before pushing.** No key in `config.json`, no committed `wrangler.toml`, no
   manuscript or reader notes that aren't theirs to publish.

## Hand back

Two lines, nothing more:

> Manuscript at a public URL → **Invite a reader** → send the link. They listen and talk;
> notes file themselves into `<repo>`, one branch per reader.
> When you want them: the book → **Reader notes** → **Download consolidated .md**, or run
> `/beta-feedback`.
