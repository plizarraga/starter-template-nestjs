# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` -- never
  a single combined tickets file.
- Triage state is recorded as a `Status:` line near the top of each issue file
  (see `triage-labels.md` for the role strings).
- Comments and conversation history append to the bottom of the file under a
  `## Comments` heading.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/`, creating the directory when
needed.

## When a skill says "fetch the relevant ticket"

Read the referenced file. The user will normally provide its path or issue
number directly.

## Wayfinding operations

Used by `/wayfinder`. The map is a file with one child file per ticket.

- **Map**: `.scratch/<effort>/map.md` contains notes, decisions so far, and
  fog.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from
  `01`, contains the question. A `Type:` line records
  `research`, `prototype`, `grilling`, or `task`; a `Status:` line records
  `claimed` or `resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked
  when every referenced file is resolved.
- **Frontier**: scan `.scratch/<effort>/issues/` for open, unblocked, unclaimed
  files; first by number wins.
- **Claim**: set `Status: claimed` and save before work begins.
- **Resolve**: append the answer under `## Answer`, set `Status: resolved`, and
  append a context pointer to the map's decisions section.
