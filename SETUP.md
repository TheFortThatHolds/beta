# Setup

Written for a human. If you'd rather hand this to an AI agent, point it at
[`AGENTS.md`](AGENTS.md) instead and say "read this and set it up for me."

There are two setups. Read the first one; you may not need the second.

---

## Setup A — no server (five minutes, free, permanent)

This is the real recommendation. It uses the speech engine already built into your browser,
so there's no key, no bill, no account, and nothing that can quietly break.

### 1. Get the file

```bash
git clone https://github.com/<you>/beta-reader.git
cd beta-reader
```

Or just download `index.html` on its own. That single file *is* the app.

### 2. Try it locally

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

Add a manuscript — file, URL, or paste — and press Play. If you hear it, you're done with
the hard part.

> **Firefox note:** Firefox's built-in speech voices are patchy on some platforms. Chrome,
> Edge, and Safari all ship good ones. If the voice sounds wrong, try a different browser
> before you conclude anything is broken.

### 3. Put it on the web (only if you're sending links to other people)

A reader can't open a file on your laptop, so to invite someone the app needs a real URL.

**GitHub Pages** — push the repo, then Settings → Pages → *Deploy from a branch* → `main` →
`/ (root)`. A minute later it's live at `https://<you>.github.io/<repo>/`.

**Cloudflare Pages** — `npx wrangler pages deploy . --project-name beta-reader`

**Netlify** — `npx netlify deploy --prod --dir .`

Any static host works. There's no build command and no output directory — the repo root is
the site.

### 4. Host your manuscript somewhere readable

The reader's browser fetches the manuscript directly, so it needs a URL that allows
cross-origin reads. A file in a **public** GitHub repo works: use the `raw.githubusercontent.com`
URL. A **private** repo will not — the browser has no credentials for it.

If the manuscript must stay private, either put it behind a URL you control that sends
`Access-Control-Allow-Origin`, or skip reader links and have people add the file themselves.

### 5. Invite a reader

In the app: pick the book → **Invite a reader** → paste the manuscript URL → **Build the
link** → copy → send it.

They open it, type their first name, and start listening. They tap **Add note here** whenever
something lands. At the end they get the debrief questions, then **Download .md** and send you
the file however you already talk to each other.

That's the whole loop. Nothing else is required, ever.

---

## Setup B — with a voice server (optional)

Add this only if you want one of three things:

- **Better narration** than the browser's built-in voice.
- **Speech-to-text** for voice notes in browsers without built-in dictation (notably Firefox).
- **Notes committed straight into a GitHub repo** instead of emailed files.

It costs money (speech APIs bill per character) and it's one more thing that can break. Setup A
is genuinely fine for most people.

### 1. Deploy the Worker

Needs a free Cloudflare account.

```bash
cd worker
cp wrangler.example.toml wrangler.toml
npx wrangler deploy
```

Wrangler prints your Worker URL — something like
`https://beta-reader.<your-subdomain>.workers.dev`. Keep it.

`wrangler.toml` is gitignored so anything account-specific in it stays out of your commits.

### 2. Add your key

```bash
npx wrangler secret put TTS_API_KEY
```

Paste the key when prompted. It's stored encrypted in Cloudflare and is **never** sent to the
browser — the app calls your Worker, and only the Worker calls the speech provider.

Works with OpenAI or any OpenAI-compatible speech API — change `TTS_API_BASE` in
`wrangler.toml` to point elsewhere.

### 3. Optional — commit notes to a repo

Create a repo to receive notes (private is fine), then:

```bash
npx wrangler secret put GITHUB_TOKEN
```

Use a **fine-grained** personal access token, scoped to that one repo, permission
**Contents: Read and write**. Nothing else. Then set in `wrangler.toml`:

```toml
NOTES_REPO = "your-name/your-notes-repo"
```

and redeploy (`npx wrangler deploy`).

Each reader gets their own branch — `beta-sam`, `beta-jordan` — with their notes at
`reviews/<book-id>.REVIEW.md`. Repeat sessions append to the same file. One branch per reader
means readers never see each other's notes and never conflict.

### 4. Optional — lock it down

```bash
npx wrangler secret put ACCESS_CODE
```

If set, every request must carry that code. Put the same value in `config.json` as
`accessCode`, or enter it in Settings. Anyone with the reader link gets the code, so this
stops casual internet traffic from burning your speech quota — it isn't real authentication.

Also tighten CORS once your site URL is settled:

```toml
ALLOWED_ORIGINS = "https://you.github.io"
```

### 5. Point the app at it

Either in the app — Settings → Voice engine → *Voice server* → paste the URL → **Test
connection** → Save — or bake it in by copying `config.example.json` to `config.json`:

```json
{
  "workerUrl": "https://beta-reader.your-subdomain.workers.dev",
  "ttsProvider": "worker",
  "remoteVoice": "alloy"
}
```

`config.json` presets what everyone gets by default; the Settings screen overrides it on that
one device.

### Checking it

Settings → **Test connection** reports each capability separately:

```
Connected — voice ✓ · transcription ✓ · note delivery ✗ (no repo set)
```

Or from a terminal:

```bash
curl https://<your-worker>/health
# {"ok":true,"tts":true,"stt":true,"notes":false}
```

---

## Troubleshooting

**No sound, browser voice.** Some browsers won't speak until you've interacted with the page —
press Play again. Check system volume and that the tab isn't muted. If your OS has no speech
voices installed (some Linux setups), install a speech engine or use Setup B.

**Voice cuts off mid-paragraph.** Known browser quirk with long utterances. The app already
chunks by sentence and runs a keep-alive to work around it. If it persists, use Setup B.

**"Fetch failed" adding a URL.** The host isn't allowing cross-origin reads, or the URL is
private. Download the file and add it with the file picker instead.

**Reader link shows "Could not load the manuscript."** Same cause — the manuscript URL isn't
publicly readable. Test it by opening the raw URL in a private browser window.

**Microphone does nothing.** The browser needs microphone permission and a secure context
(`https://` or `localhost`). Over plain `http://` on a non-local host, browsers block the mic
entirely.

**Notes vanished.** Notes live in that browser's local storage, per device. Clearing site data
or using a different browser loses them. Tell readers to download their `.md` when they finish —
that's the durable copy.

**Worker returns 401.** `ACCESS_CODE` is set on the Worker but the app isn't sending it. Put it
in Settings or `config.json`.

**Worker returns 403 / CORS errors.** `ALLOWED_ORIGINS` doesn't include the origin serving the
app. Add it exactly, scheme included, no trailing slash.
