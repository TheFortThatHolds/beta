# The review file format

What Beta Reader writes, and what a downstream tool or agent can rely on.

Three files matter:

| File | Written by | Holds |
|---|---|---|
| `reviews/<book-id>.REVIEW.md` | one reader, on their own branch | that reader's notes |
| `<book-id>.CONSOLIDATED.md` | the author side, after pulling every reader | all readers, grouped by passage |
| `<book-id>.<reader>.REVIEW.json` | a reader's local download | the same review, machine-readable |

Notes reach the author through the Worker: `POST /notes` commits one reader's file to their
own `beta-<reader>` branch, and `GET /notes?bookId=` hands back every reader's file for one
book. `GET /readers` lists who has submitted what. The app's collation screen is just those
endpoints plus the grouping described below.

---

## Markdown — `<book-id>.<reader>.REVIEW.md`

```markdown
# Beta Review: The Lighthouse at Kestrel Point
Reader: sam
Book: the-lighthouse-at-kestrel-point
Session: 2026-07-27

## Note 1 — Passage 4
> The lamp had gone out at some point in the night, and Ida had not noticed.

This is where I actually sat up. Up to here I thought it was a quiet story.

---

## Note 2 — Passage 11
> She counted the stairs on the way down, the way she had as a girl.

The counting detail is doing a lot. I'd cut the sentence after it.

---

## Debrief

### The big picture
**Did the book deliver what you expected when you started?**

Not at all, and I mean that well.

### Pacing and structure
**Did you ever want to skip ahead?**

Around the middle, yes — the section in the boat shed.
```

### Guarantees

- The file opens with `# Beta Review: <title>`.
- The next three lines are `Reader:`, `Book:`, `Session:` in that order. `Book:` is the book id,
  `Session:` is `YYYY-MM-DD`.
- Each note is `## Note <n> — Passage <m>`, where `n` counts notes in this file and `m` is the
  1-based passage index.
- Immediately under each note heading is a single `>` blockquote line — the passage the note is
  attached to, truncated at 300 characters.
- Then a blank line, the note body (may span multiple lines), then `---`.
- `## Debrief` appears only if at least one question was answered. `###` lines are section
  names; `**bold**` lines are the questions; the answer follows.
- Everything is UTF-8, LF line endings.

### Appending

When notes are delivered to a repo via the Worker, a second session **appends** to the existing
file rather than replacing it. So one file can contain several `# Beta Review:` blocks, oldest
first. Parse for repeated header blocks, not just one.

---

## JSON — `<book-id>.<reader>.REVIEW.json`

```json
{
  "book": {
    "id": "the-lighthouse-at-kestrel-point",
    "title": "The Lighthouse at Kestrel Point",
    "author": "A. Writer",
    "source": "https://example.com/lighthouse.md"
  },
  "reader": "sam",
  "session": "2026-07-27T18:40:12.004Z",
  "notes": [
    {
      "passage": 4,
      "quote": "The lamp had gone out at some point in the night…",
      "note": "This is where I actually sat up.",
      "at": "2026-07-27T18:22:47.881Z"
    }
  ],
  "debrief": [
    {
      "question": "Did you ever want to skip ahead?",
      "section": "Pacing and structure",
      "answer": "Around the middle, yes."
    }
  ]
}
```

`debrief` contains only answered questions. `section` is `null` on questions that don't start
a new group.

---

## Mapping a passage number back to the manuscript

`passage` is a **1-based index into the parsed unit list**, not a line number and not a chapter
number. To resolve it, parse the manuscript exactly the way the app does:

1. Normalise line endings to `\n`.
2. Drop fenced code blocks (` ``` ` / `~~~`).
3. Drop lines that are a whole HTML comment (`<!-- … -->`).
4. Drop horizontal rules (`---`, `***`, `___`).
5. A line matching `^#{1,6}\s+(.+)` is its own unit — **headings occupy a passage index.**
6. Otherwise, consecutive non-blank lines join with single spaces into one paragraph unit;
   a blank line ends it.
7. Strip inline Markdown decoration from every unit — `**bold**`, `_italic_`, `` `code` ``,
   images, and link syntax (`[text](url)` keeps only `text`) — and collapse runs of
   whitespace. Quotes in the review file are stored in this cleaned form.
8. Number the resulting units from 1.

**Use the quote as the real anchor.** The index is stable only against the exact file the
reader listened to — if the manuscript is edited between the read and the apply, indices shift
but quotes still find their passage. Match on the quote first, fall back to the index.
