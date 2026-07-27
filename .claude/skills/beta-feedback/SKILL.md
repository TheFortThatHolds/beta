---
name: beta-feedback
description: Pull every beta reader's notes for a book and tell the author what they actually said — consensus first, then splits, then one-offs. Use when someone says "what did the readers say", "pull the beta feedback", "summarize the reader notes", "what's the consensus on <book>", or hands over a consolidated review file.
---

# /beta-feedback

Read the readers, then say what they said. Do not narrate the fetching.

## Get the notes

Whichever of these is available, in order:

1. **The author already has the consolidated file** (from the app's *Reader notes → Download
   consolidated .md*, or pasted in). Use it. Don't go fetch anything.
2. **The Worker.** `GET <workerUrl>/notes?bookId=<id>` returns
   `[{reader, branch, markdown}]` — every reader's raw review file for that book. Add
   `X-Access-Code` if the deployment sets one. `GET <workerUrl>/readers` lists who has
   submitted what if you need to find the book id.
3. **The notes repo directly.** One branch per reader, `beta-*`, file
   `reviews/<book-id>.REVIEW.md`. Read each branch.

If you can't tell which book, ask — one question, not a list.

## Parse it

`NOTES_FORMAT.md` in this repo is the contract. Two things to hold onto:

- **A file can contain several appended sessions.** Split on `# Beta Review:` — don't assume one.
- **The `>` quote under each note is the real anchor, not the passage number.** Indices move
  the moment the manuscript is edited. Match on the quote; treat the number as a hint.

## Report

Lead with the thing that changes what the author does. Structure:

1. **Consensus** — passages more than one *reader* hit (two notes from the same reader across
   two sessions is not consensus), and what they agree on. This is the top of the report because
   it's the only feedback that's near-certainly real.
2. **Splits** — where readers directly contradict each other. Name both sides. Don't resolve it
   for them; a split usually means the passage is doing something polarising on purpose, or it
   isn't landing at all, and only the author knows which.
3. **Solo notes worth keeping** — filter hard. A single reader's reaction is a data point, not
   a mandate. Include it if it's specific and concrete; drop "I liked this."
4. **The debrief answers**, grouped by question, so the same question's answers sit together.
5. **What surprised you** — one short paragraph. You read all of it at once; the author didn't.
   Say the thing nobody flagged explicitly but that's sitting under three separate notes.

Keep it tight. The author wants to know what to change, not to re-read their book through
someone else's eyes.

## Then stop

Ask what they want to act on before touching a manuscript. Applying notes is a separate
decision and it's theirs — beta feedback is taste, not defect reports, and a HIGH-severity
reader reaction can still be the right creative call to ignore.

If they do want notes applied, and the manuscript is in a repo you can reach: change the
canonical chapter file in place and keep the pre-change version in an archive folder. Never
leave two files with no signal which one is real.
