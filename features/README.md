# Products

Every folder here is one product: something SevenFold could sell on its own. A
product owns its slice of the report, the events it streams, the prompts it
sends, the pipeline stage that runs it and the UI that shows it. Two people (or
two agents) can work on two products at once without touching the same files.

| Folder | Product | Stage(s) | Usage labels |
| --- | --- | --- | --- |
| `deck-reader/` | Reads the PDF slide by slide (embedded text, then vision OCR) | runs before the pipeline, in `lib/analyses/run.ts` | `ocr` |
| `memo/` | The due-diligence memo: company, problem, solution, market… | `extract` (deck pass), `complete` (gap fill) | `extract`, `complete` |
| `founders/` | The founders and the cap table | filled by the memo stages | — |
| `research/` | Web research on the gaps the deck left | `research` | `search` |
| `landscape/` | Competitive landscape: two axes, every competitor plotted | `landscape` | `landscape-search`, `landscape` |
| `scorecard/` | The six 1–5 ratings and funding raised | `scorecard` | `scorecard` |
| `feedback/` | Critique of the deck itself | `feedback` | `feedback` |
| `verdict/` | The invest / pass call from the trained model | `verdict` | — |

## Layers

```
lib/core/               the kernel: stage runner, parsing, prompt context, LLM helpers
   ↑
features/<product>/     one folder per product (this directory)
   ↑
lib/diligence/          pipeline composition: the form, the event union, the reducer, the stage list
components/features/analyze/   UI composition: the report section registry, the analysis shell
   ↑
app/                    routes
```

## Pages

Each analysis is a set of pages under `/dashboard/analyses/<id>`, one per
product, except that verdict, scorecard and feedback share the Results page:

| Path | What's on it |
| --- | --- |
| `/dashboard` | The dropzone, the last five analyses as cards, the account's numbers |
| `/dashboard/analyses` | Every analysis on the account, and the dropzone |
| `/dashboard/analyses/<id>` | The overview: the call, and one card per page saying how far it got |
| `/dashboard/analyses/<id>/<slug>` | One page: `deck`, `memo`, `founders`, `research`, `landscape`, `results` (the verdict, then the scorecard, then the feedback), or `report` (everything) |

Inside an analysis the sidebar swaps the dashboard's pages for the analysis's
tabs, each with a status dot. The pieces:

- `lib/products.ts`: the page list (slug, label, description). The sidebar,
  the overview and the route all read it.
- `components/features/analyze/productTabs.tsx`: for each page, which report
  sections it shows, its status (ready, running, didn't finish, not in this
  report) and its one-line summary.
- `components/features/analyze/ReportProvider.tsx`: loads the open analysis
  once, from the live run or the database, for the page and the sidebar.
- `app/dashboard/analyses/[id]/layout.tsx` and `AnalysisFrame.tsx`: the header
  and loading states every page of an analysis shares.

Old `/due-diligence/…` and `/dashboard/due-diligence/…` links redirect here,
and an analysis's old `scorecard` and `feedback` pages redirect to its
`results` page (`next.config.ts`).

`components/report/` holds the shared report primitives (`Row`, `Skeleton`,
`SourceBadge`, `SourceLegend`, `SourceRow`, `SearchList`) and `components/ui/`
the generic ones (`Card`, `Dropzone`). Products use both; neither knows any
product.

## Inside a product

| File | What it holds | May import (values) |
| --- | --- | --- |
| `types.ts` | The product's slice of the form, its events, its live state | `lib/core` |
| `form.ts` | Its form sections (field keys, labels, hints) and its blank slice | `lib/core` |
| `state.ts` | `initial…State()` and `fold…(state, event)` for the live report | `lib/core` |
| `parse.ts` | Turning model output into the product's data | `lib/core` |
| `prompts.ts` | Its prompt instructions, wrapped in `withDeckContext` | `lib/core` |
| `stage.ts` | The pipeline stage(s): calls the model, writes the form, emits events | anything in `lib/` and packages; nothing from `components/`, its own `ui/` or another product |
| `ui/` | The product's React components | anything in `lib/`, `components/report`, `components/ui` and packages; not its own `stage.ts` or `pdf/`, and no other product |
| `pdf/` | deck-reader only: reading the PDF on the server (its `stage.ts`, in effect) | the same as `stage.ts` |

Files directly in the product folder, except `stage.ts`, are pure: they import
values only from `lib/core` and from each other (no packages, no Node
built-ins, no `import()`), so they run in the browser, on the server and in
tests alike. Type-only imports are fine from anywhere rules 1 and 3 allow. The
subfolders (`ui/`, `pdf/`) aren't pure.

## Rules

These are enforced by `npm run lint` (`eslint.config.mjs`), for every folder in
here, including new ones. They hold however the import is written: `@/…`, a
relative path, `import("…")` or `require("…")`. Lint rejects the forms it can't
check: `import()` of anything but a plain string, `import("…").Name` types, and
`@/` paths with `./` or `../` in them. Type-only imports count too, except
under rule 2.

1. **A product never imports another product.** When one needs another's
   output, the composition layer passes it in. Example: the memo grid draws the
   founders rows through a `renderers` prop that
   `components/features/analyze/reportSections.tsx` fills with `FoundersRows`.
2. **A product's pure files import values only from `lib/core`** and from each
   other.
3. **Products don't import `app/`, and from `components/` only
   `components/report` and `components/ui`.** Inside a product, server code
   (`stage.ts`, `pdf/`) imports no UI, and `ui/` imports no server code.
4. **The shared layers know no product.** `lib/core` imports only itself,
   `lib/llm` and `lib/config`. `components/report` and `components/ui` import
   only each other, `lib/core` and `lib/sources`. All three may import packages.

One gap lint can't close: `lib/diligence` re-exports the products' types
(`lib/diligence/types.ts`) and `SCORECARD_METRIC_KEYS`
(`lib/diligence/form-schema.ts`) for the composition code. A product may take
its own types back that way, but reaching another product's through a
re-export still breaks rule 1, even though lint lets it through.

## Things that must never change

Saved analyses are the `state` jsonb of old runs, replayed by today's code.

- **Event `type`s and usage `stage` labels are never renamed.** Event types
  are persisted in saved reports. Usage labels aren't saved (the recorder
  drops `usage` events), but the server log, the dev cost sidebar and any
  cost tracking key on them.
- **Form and state keys are never renamed.** New keys go at the end of a
  product's slice, for tidiness only: jsonb doesn't keep key order, so nothing
  may depend on it.
- **New state is optional on read.** A report saved before a product existed
  has no slice for it. Treat absent as "not run", never as "failed".
- **Shared prompt context stays byte-identical.** Every stage sends the same
  cached `withDeckContext` front; a per-stage change there makes every stage
  pay full price for the deck again.

## Adding a product

The full checklist is in the root `AGENTS.md`, under "Adding a product (or a
new stage)". In short: the folder here, then a line or two in each of
`lib/diligence/types.ts`, `form-schema.ts`, `stream-state.ts` and `engine.ts`,
`lib/analyses/run.ts`, `lib/config.ts`, `reportSections.tsx`,
`lib/products.ts`, `productTabs.tsx` and `lib/analyses/markdown.ts`.
Everything else stays in the product's folder.

## Working on one product

Keep the change inside `features/<product>/`. If it needs a registry line in
one of the composition files above, keep it to that line. Check with:

```bash
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Before you report back, update the root `AGENTS.md` (and the tables here) so
they describe the project with your change in it.
