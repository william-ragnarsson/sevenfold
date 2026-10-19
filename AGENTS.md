<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SevenFold: guide for agents

SevenFold reads a startup's pitch deck and produces due diligence for a VC.
Upload a PDF and it streams back a set of products, each on its own page:

- the deck read slide by slide
- a filled-in memo
- the founders
- web research
- a competitive landscape
- a six-rating scorecard with an invest/pass call from a trained model
- feedback on the deck itself

Each product is meant to be sold on its own. The code is split so that one
agent can work on one product without touching another's files.

Stack:

- Next.js 16 (App Router), React 19, Tailwind 4 and TypeScript (strict).
- Supabase for accounts, saved analyses and PDF storage.
- Gemini for every model call (`@google/genai`). The Claude adapter is kept
  only as an outage fallback.
- An ONNX model for the verdict (`onnxruntime-node`).
- An MCP server, so Claude can run analyses.
- Deployed on Vercel at vcanalyst.williamragnarsson.dev.

## Start here

1. **Find your task** in the [backlog](#task-backlog) below. The owner assigns
   one task per agent by its ID (T1, T2, …).
2. **Check your checkout.** If it has no `features/` folder, it's a `main`
   from before the product split. Stop and tell the owner.
3. **Read its block.** Read "Not alongside" and "Start after" first. If a task
   listed there is in progress, or hasn't landed and yours needs it, tell the
   owner before you start.
4. **Read the code it names**, plus [the rules](#rules-for-every-change).
   Before a product change, also read `features/README.md`.
5. **When you finish,** edit your task's lines and nothing else:
   - Set its `Status:` line to `done`.
   - Add anything you found but didn't do as `Follow-up:` lines inside your
     task's block.
   - Don't add new task IDs. The owner does that.

   Parallel branches then merge without conflicts.
6. **Before you report back,** run [the checks](#checks).
   - Say exactly what you verified and how.
   - Say what you couldn't verify, and why.

## Code map

Products build on `lib/core`. Their `stage.ts` and `ui/` may also use
`lib/config`, `lib/llm`, `lib/invest`, `lib/sources`, `lib/routes`, and
`lib/diligence`'s types and field helpers. The composition layer
(`lib/diligence`, `components/features/analyze`) wires the products together,
and `app/` sits on top. `npm run lint` enforces part of this; see
[Boundaries](#boundaries).

| Path | What it is |
| --- | --- |
| `app/` | Routes (see [Routes](#routes)). `app/api/analyze/route.ts` starts a run; `app/mcp/route.ts` is the MCP server endpoint |
| `proxy.ts` | Next 16's replacement for middleware (exports `proxy`, always on Node). Refreshes the Supabase session cookies on every request except static assets, `/mcp` and `/.well-known/*`. Sends signed-out and anonymous visitors from `/dashboard` and everything under it to `/sign-in?next=<path>`. Does nothing when Supabase isn't configured |
| `features/<product>/` | One folder per product: its types, form slice, live state, prompts, parser, pipeline stage and UI. Rules in `features/README.md` |
| `lib/core/` | The kernel, which knows no product. Stage runner (`stage.ts`), core events, field parsing and source priority (`parse.ts`), `fillFields`, `withDeckContext`, `reportUsage` |
| `lib/diligence/` | Pipeline composition. The full form type and event union (`types.ts`), blank form and memo sections (`form-schema.ts`), the reducer every client and the server fold events with (`stream-state.ts`), the stage list (`engine.ts`), and the browser's NDJSON reader (`stream.ts`, `readProgressStream`) |
| `lib/analyses/` | Runs and storage. `run.ts` (one analysis end to end), `persist.ts` (server writer, rate limits), `store.ts` (browser reads and deletes under RLS, plus signed deck URLs), `markdown.ts` (the report as markdown, for MCP), `status.ts`, `hash.ts`, `pdf-source.ts`, `pending-deck.ts`, `legacy.ts` |
| `lib/llm/` | Provider adapters (`gemini.ts`, `claude.ts`) and `pricing.ts` |
| `lib/config.ts` | Almost every env var, each read through a getter: model per stage, thinking per stage, token and search budgets, Supabase keys. Exceptions: `NEXT_PUBLIC_SITE_URL` is read directly in `app/layout.tsx` and `lib/mcp/server.ts`, and `proxy.ts` reads the `NEXT_PUBLIC_SUPABASE_*` vars itself |
| `lib/playbook/load.ts` | `loadPlaybook()`: reads `docs/playbook.md` from disk at run time, once per process |
| `lib/sources.ts` | `domainOf` and `faviconOf`. The only `lib` module besides `lib/core` that `components/report` and `components/ui` may import |
| `lib/mcp/` | The MCP tools and prompt (`server.ts`) and the OAuth metadata (`metadata.ts`) |
| `lib/invest/` | The verdict's ONNX model (`model.onnx`, `model.ts`) and the numbers behind `/dashboard/model` |
| `lib/products.ts` | The pages an analysis has (slug, label, description), in sidebar order |
| `lib/routes.ts` | Page paths only: `ROUTES`, `analysisPath`, `deckSlidePath`, `signInPath`, `safeNext`. API, `/auth/*` and `/mcp` paths are written inline where they're used, and `supabase/templates/*.html` hardcode `/auth/confirm`, `/dashboard` and `/dashboard/account/password` |
| `lib/samples/airbnb.ts` | The sample deck, pre-transcribed so it skips OCR |
| `lib/supabase/` | Browser, server, admin and bearer-token clients, plus row types |
| `components/features/analyze/` | UI composition and the analysis shell. `AnalysisProvider` (the live run), `ReportProvider` (the open analysis), `reportSections.tsx` (section registry), `productTabs.tsx` (each page's sections, status and summary). `AnalysisLauncher` (every dropzone), `AnalysisFrame` (the layout around every analysis page: loading and missing states, the dev cost sidebar), `AnalysisOverview`, `ProductView`, `ReportView`, `useLiveRun`, `DevCostSidebar`. `DashboardHome` (dropzone, five recent cards, metrics), `RecentAnalyses` (the full list with delete and clear all, on `/dashboard/analyses` and `/dashboard/account`), `AnalysisWorkspace` (the `/dashboard/analyses` body) |
| `components/app-shell/` | Dashboard layout and sidebar. The sidebar swaps to an analysis's tabs when one is open |
| `components/features/{auth,hero,landing,model}/` | Sign-in and accounts, the landing page, and the `/dashboard/model` explainer |
| `components/report/`, `components/ui/` | Shared primitives (`Row`, `SourceBadge`, `Sources`, `Card`, `Dropzone`). The only components a product may import |
| `components/layout/` | Marketing shell, nav bar, footer |
| `docs/playbook.md` | The VC rubric. **Runtime prompt input**: every stage sends it, and `/dashboard/rubric` renders it. Editing it changes analysis output |
| `supabase/migrations/`, `supabase/templates/` | SQL migrations; auth email templates |
| `ml/` | Offline training for the invest model (Python, `uv`). Never deployed. `ml/data/` is confidential and gitignored |

### Routes

| Path | What |
| --- | --- |
| `/` | Landing page. The hero and closing call-to-action each hold a dropzone |
| `/sign-in` | Google or email/password |
| `/oauth/consent` | Consent screen when Claude connects over MCP |
| `/auth/callback`, `/auth/confirm` | OAuth code exchange; email links |
| `/dashboard` | Dropzone, the five most recent analyses as cards, and "at a glance" metrics |
| `/dashboard/analyses` | A dropzone (plus the legacy import prompt), then every analysis, each deletable, plus Clear all |
| `/dashboard/analyses/<id>` | Overview: the verdict, plus one card per product showing how far it got |
| `/dashboard/analyses/<id>/<slug>` | One product's page (`deck`, `memo`, `founders`, `research`, `landscape`, `scorecard`, `feedback`, `report`). The deck page takes `?slide=N` |
| `/dashboard/model`, `/dashboard/rubric` | Invest-model explainer; the playbook |
| `/dashboard/account` | Profile, password link, data export, the analyses list, account deletion |
| `/dashboard/account/password` | Set or change the password |
| `/api/analyze` | POST, NDJSON stream. Needs an account when Supabase is configured |
| `/api/account/export`, `/api/account/delete` | Account data |
| `/mcp` | MCP over OAuth (Supabase is the authorization server) |
| `/.well-known/oauth-protected-resource` | OAuth resource metadata. `/.well-known/oauth-protected-resource/mcp` rewrites to it, and is where `/mcp`'s 401 points |

- When Supabase is configured, `proxy.ts` gates `/dashboard` and everything
  under it: signed-out and anonymous visitors go to sign in. With accounts off,
  nothing is gated.
- The `/api` routes check the user themselves.
- `<id>` is the row's `deck_hash`: the hex SHA-256 of the PDF bytes, or of the
  trimmed deck text for MCP runs. Analyses imported from the old localStorage
  keep their old id. The route doesn't validate it.
- Old paths redirect (307) to their dashboard pages (`next.config.ts`):
  `/due-diligence/*`, `/dashboard/due-diligence/*`, `/model`, `/playbook` and
  `/account/*`. Don't reuse them.

### How a run works

1. The dropzone (`AnalysisLauncher`) calls `AnalysisProvider.start` with the
   file. The sample sticker calls `startSample`.
   - Signed out: the deck is stashed in IndexedDB and the user is sent to
     sign in. `ResumeStashedDeck` picks it up afterwards.
   - Otherwise: it navigates to `/dashboard/analyses/<id>`. If that deck
     already has a `done` row, the row is shown with no POST (unless `force`
     is set). Otherwise it POSTs the PDF (`file`) or the sample's id
     (`sample`) to `/api/analyze`.
2. The route calls `requireAccount()`. That rejects signed-out and anonymous
   callers, and returns null when Supabase isn't configured. Then it calls
   `recordFor(owner, …)` (`lib/analyses/persist.ts`):
   - It checks the rate limit: at most 25 new analyses per account in a
     rolling 24 hours, counted by the rows' `created_at`. A rerun of a saved
     deck reuses its row and isn't counted. (A cap of 5 applies only to
     anonymous MCP tokens, which exist only under `next dev`.)
   - It upserts the row on `(user_id, deck_hash)` with a fresh
     `initialState()` and uploads the PDF.
   - It returns a `SupabaseRecorder`. With no owner (accounts off), or when
     the claim fails, it returns `NOOP_RECORDER` instead, and the browser run
     carries on unsaved. Over the limit it throws `RateLimitError`.
3. The route then calls `runAnalysis` (`lib/analyses/run.ts`), which never
   throws.
   - deck-reader reads the PDF: embedded text first, vision OCR if needed.
   - Then the engine runs `STAGES` (`lib/diligence/engine.ts`). Every stage
     mutates one shared `ctx.form` and emits events.
   - Finally it sends one `report` event and the recorder's `finish()`.
4. Each event goes two ways:
   - Streamed to the browser, where `streamReducer` folds it into
     `AnalysisState`.
   - Folded by the recorder with the same reducer and saved every 3 s into
     `analyses.state` (jsonb).
5. If the browser disconnects, `req.signal` aborts the run and the row is
   saved as failed. The comments in `app/api/analyze/route.ts` and the top of
   `persist.ts` that say the run carries on are stale (T20).
6. Opening a saved analysis: `ReportProvider` loads that row. It polls every
   4 s while a run started elsewhere (MCP, another tab) is still going.

MCP runs (`lib/mcp/server.ts`: `analyze_deck`, `get_analysis`,
`list_analyses`, plus the `analyze` prompt) differ:

- Auth is an OAuth bearer token (`app/mcp/route.ts`).
- The client sends the deck as text, so there's no PDF, upload or OCR.
- The id is the SHA-256 of the trimmed text. Unless `rerun: true`, a finished
  report for that text is returned without running, and a run already in
  flight is waited on.
- It refuses to run when the row can't be saved.
- The run continues after the response (`after()`) and is stopped by a 285 s
  `AbortSignal.timeout`.
- `analyze_deck` waits up to 50 s. If the run is done by then, it returns the
  report as markdown (`renderReport`, `lib/analyses/markdown.ts`). Otherwise
  it returns the progress so far (`renderProgress`) and an `analysis_id`.
  `get_analysis` re-reads the row every 3 s, for up to `wait_seconds` (at
  most 50) per call.

### The pipeline

Defined in `lib/diligence/engine.ts`. `lib/core/stage.ts` starts each stage
as soon as the stages it `needs` are done.

| Stage | Product | Needs | Critical | Web search | Usage label | Model / thinking env |
| --- | --- | --- | --- | --- | --- | --- |
| (before the pipeline) | deck-reader | — | yes | no | `ocr` | `OCR_MODEL`, `OCR_THINKING` |
| `extract` | memo | — | yes | no | `extract` | `EXTRACT_MODEL`, `EXTRACT_THINKING` |
| `landscape` | landscape | extract | **no** | yes | `landscape-search`, `landscape` | `LANDSCAPE_MODEL`, `LANDSCAPE_THINKING` |
| `research` | research | extract | yes | yes | `search` | `RESEARCH_MODEL`, `RESEARCH_THINKING` |
| `complete` | memo | research | yes | no | `complete` | `COMPLETE_MODEL`, `COMPLETE_THINKING` |
| `scorecard` | scorecard | complete | yes | no | `scorecard` | `SCORECARD_MODEL`, `SCORECARD_THINKING` |
| `feedback` | feedback | scorecard | yes | no | `feedback` | `FEEDBACK_MODEL`, `FEEDBACK_THINKING` |
| `verdict` | verdict | feedback, landscape | yes | no | — (local ONNX, free) | — |

- Every model defaults to `gemini-3.5-flash-lite`.
- An unset `*_THINKING` means the model's lowest level.
- The critical path is five model calls in a row (six with OCR): extract,
  research, complete, scorecard, feedback.
- Verdict reads `form.scorecard` and gets it only through `feedback`. If you
  change `needs`, keep that dependency.
- A critical failure aborts the whole run. A non-critical one is reported
  through the stage's `onError`.

## Rules for every change

### Boundaries

`npm run lint` (`eslint.config.mjs`) enforces these:

- A product never imports another product. When one needs another's output,
  the composition layer passes it in as a prop (see `MEMO_RENDERERS` and
  `ReportEnv.slideHref` in `reportSections.tsx`).
- A product's top-level files, except `stage.ts`, are pure. They import values
  only from `lib/core` and their siblings: no packages, no Node built-ins, no
  `import()`.
- In a product, `stage.ts` and `pdf/` are server code and `ui/` is browser
  code. Neither imports the other.
- Products never import `app/`, and from `components/` only
  `components/report` and `components/ui`.
- `lib/core` imports only itself, `lib/llm` and `lib/config`.
  `components/report` and `components/ui` import only each other, `lib/core`
  and `lib/sources`. None of the three knows a product.
- Write `@/` imports without `./` or `../` inside them.
- New product folders are picked up by lint automatically.

Lint doesn't catch a product reaching another product's types or values
through the `@/lib/diligence/*` re-exports. Don't do it.
[T15](#t15-stop-re-exporting-product-types-from-libdiligence) closes the gap.

### Saved reports replay forever

Old analyses are their saved `state` jsonb, replayed by today's code. So:

- **Never rename** any of these:
  - event `type` strings
  - form or state keys
  - the top-level `startedAt` and `verdict`, which SQL reads
- **Never rename a usage label either.** Labels aren't saved, but the server
  log, the dev cost sidebar and per-product cost tracking (T8) key on them.
- **New keys go at the end of a product's slice.** That's only tidiness:
  jsonb doesn't keep key order, so nothing may depend on it.
- **New keys are optional.** An old report has no slice for a new product.
  - Absent means "not run", never "failed".
  - Give the product's `PRODUCT_TABS` entry an `absent` check.
  - Make every reader handle `undefined`.
- **Never change a field's meaning in place.** Add a flag instead, the way
  `fundingInUsd` marks the newer funding format.
- **Write `ctx.form` and also emit an event.** The form's non-field slices
  reach the saved state only through the final `report` event, and a run that
  stops short never sends it.
- **Keep state JSON-serializable** (no `Date`, `Map` or functions) and **bound
  anything that grows**.
- **Keep the shared prompt prefix byte-identical.** Every stage sends the same
  `withDeckContext(playbook, deckText, …)` front so Gemini's cache hits. Put
  per-stage text in the instructions part.

### Cost: the owner pays for every model call

- **Never start an analysis without the owner's explicit OK in chat.** That
  covers an upload, the sample deck, MCP `analyze_deck`, or a script that
  calls a model.
  - Say first what it will run and roughly what it costs.
  - A run makes about 7 model calls, plus OCR for scanned PDFs.
  - On the default models that's an unmeasured few cents each.
  - Gemini web searches are free up to an allowance, then billed: 3.x models
    $14 per 1,000 queries after 5,000 a month; 2.5 models $35 per 1,000
    grounded prompts after 1,500 a day (`lib/llm/pricing.ts`).
  - The sample deck skips only OCR. Every other stage still bills.
- The dev cost sidebar (`DevCostSidebar`, dev only) shows each stage's real
  cost during a live run. So does the server log (`💰 usage:`).
  - Tracked cost is an upper bound: free search allowances aren't subtracted.
  - Usage is never saved: `persist.ts` drops `usage` events.
- **Ask before** raising a default model, thinking level, token or search
  budget; adding a paid service or API; or upgrading any plan (Vercel,
  Supabase, Google).
- A new model id needs:
  - an entry in `KNOWN_MODELS` (`lib/config.ts`), since `envModel` rejects
    anything else;
  - a row in `lib/llm/pricing.ts`, or it's tracked at $0;
  - a line in `.env.example`'s list of models;
  - for a Gemini id, an entry in the `THINKING` table (`lib/llm/gemini.ts`),
    so its lowest thinking level is known rather than guessed.
- A stage that searches the web takes its budget from config (today
  `getResearchMaxSearches()`) and passes it to its prompt builder, never a
  number written into the prompt.
  - On Gemini the budget is only a request in the prompt. Only the Claude
    adapter enforces it (`max_uses` in `lib/llm/claude.ts`).
  - Research still hardcodes 3 (T16).

### Secrets and env

- **Never print, log or commit a secret value.** Don't echo `.env` or paste
  keys into chat.
- New env names go in `lib/config.ts`, read through a getter, plus
  `.env.example` as a commented line showing the default. A secret gets a
  placeholder such as `sb_secret_...`, never a real value.
- In some worktrees `.env` is a symlink to the main checkout's `.env`. Editing
  it there edits the owner's real file, so ask first.
- Restart the dev server after any `.env` change.

### Database

- The Supabase project in `.env` is **production**. Read only.
  - No migrations, inserts, updates or deletes without the owner's OK.
  - No signing in through it, creating accounts or entering passwords.
- **Schema drift:** live has two migrations the repo doesn't, recorded by
  [T13](#t13-backfill-the-two-migrations-that-are-live-but-not-in-the-repo).
  Number your migration `0005` or higher.
- Every new table gets RLS. A table users must not read gets no user
  policies.
- Migration `0002` stops OAuth-client (MCP) tokens from deleting analyses and
  from touching the `decks` storage bucket at all (read, upload, update,
  delete). Keep that true for anything new.

### Checks

There's no CI, so nothing checks a PR for you. Run all three:

```bash
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

- `npm run build` doesn't lint in Next 16, and `next lint` no longer exists.
- There's no JS test runner yet; [T1](#t1-add-a-test-runner-and-a-replay-test)
  adds one. Once it lands, also run `npm test`.
- The Python model tests run separately: `cd ml && uv run pytest -q`.

### Checking UI in a browser

Use the preview tool's "Next.js dev server" config (port 3000), not a shell
command. Don't edit `.claude/launch.json` without asking the owner.

- `/dashboard` is gated, and a browser agent can't sign in. Free to check
  today: `/`, `/sign-in`, and the landing page's report mock.
- With accounts off, the dashboard shell, `/dashboard/model` and
  `/dashboard/rubric` render too.
  - Accounts-off mode means Supabase env blanked:
    `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run dev`.
    This should work but hasn't been tried.
  - It needs a launch entry the owner adds.
  - Nothing is saved, but a run still costs money.
- Saved report pages can't be checked without real data until
  [T2](#t2-localhost-demo-mode) adds a demo mode. Say so instead of guessing.

### Next.js 16

- Read `node_modules/next/dist/docs/`. The upgrade guide is
  `01-app/02-guides/upgrading/version-16.md`.
- `proxy.ts` replaces `middleware.ts` and always runs on Node.
- Dev writes `.next/dev`, so a build can run while the dev server is up.
- Use npm (`package-lock.json`). Node 22 or newer (Supabase needs it).
- A file read from disk at run time must be listed in
  `outputFileTracingIncludes` (`next.config.ts`), or the deploy may not have
  it.
  - List it under both the `/api/analyze` and the `/mcp` keys, since both
    routes run the pipeline.
  - Today `docs/playbook.md` is listed only under `/mcp`. Tracing may follow a
    literal `process.cwd()` path on its own, but that's unconfirmed.
  - Tracing can't follow a dynamic path, such as the sample decks, so those
    must be listed.

### Git

- Branch from `main`, one branch and one PR per task.
- Commit and push only when the owner asks.
- PRs merge into `main` as merge commits. To catch up, merge `main` in rather
  than rebasing.
- Commit subjects are imperative sentence case, no prefix, for example
  "Point each deck-feedback item at the slides it's about". The body says
  why.
- The git stash is shared by every worktree. Never use bare `git stash`.

## Changing a product

Within one product, keep the change in `features/<product>/`. If it needs a
registry line in a composition file, keep it to that line. Two products that
need to talk go through the composition layer, never an import.

### Adding a product (or a new stage)

Every step is a line or two in a shared file. `tsc` catches some missed steps,
but not all.

1. **`features/<name>/`:**
   - Add `types.ts`; `form.ts` if the product writes `ctx.form`; `state.ts`
     (its initial state and fold) if it has live state or events; and
     `prompts.ts`, `parse.ts`, `stage.ts` and `ui/` as needed.
   - Not every product has every file today: memo and founders have no
     `state.ts`, deck-reader has no `form.ts`, and scorecard has no fold.
   - Make the slices optional (deck-reader's `deck` is the example).
   - The fold is
     `foldX<S extends XState>(state: S, event: ProgressEvent): S`, and it
     returns the same `state` for events it doesn't handle (for example
     `default: return state`).
2. **`lib/diligence/types.ts`:** add `XForm` to `DueDiligenceForm extends …`
   and `XEvent` to the `ProgressEvent` union.
3. **`lib/diligence/form-schema.ts`:**
   - Add `...emptyXForm()` to `emptyForm`.
   - Add the product's section to `DD_SECTIONS` only if the memo's
     `extract`/`complete` stages should fill its fields. A section there
     feeds both prompts' field list, the research gaps, the memo page and its
     field count, the chapters nav, the deck page's field evidence and the
     markdown. Only a section titled "Scorecard" is kept off the memo
     (`DOC_SECTIONS`).
   - Keys that aren't plain text cells need a `FIELD_HANDLERS` entry.
   - A new non-text kind also needs a `FieldKind` member
     (`lib/core/schema.ts`), a `MEMO_RENDERERS` entry (`reportSections.tsx`)
     and a case in `renderReport` (`markdown.ts`).
4. **`lib/diligence/stream-state.ts`:**
   - Add `XState` to `AnalysisState extends …` and `...initialXState()` to
     `initialState`.
   - Add `foldX` to `PRODUCT_FOLDS`. A product with no events needs no entry.
   - If the slice is mirrored in the form, add a line to the `report` case.
5. **`lib/diligence/engine.ts`:**
   - Add the stage to `STAGES`, after every stage it `needs`; listing it
     earlier throws.
   - Update the doc comment.
   - Make it `critical: false` unless the report is meaningless without it,
     and follow the landscape pattern for failure:
     - `onError` emits an `x-failed` event (it isn't called when the run is
       cancelled);
     - the fold stores an optional `xError`;
     - the `PRODUCT_TABS` status returns `"failed"` when it's set;
     - the section's `available` stays true on error, so the page says why.
6. **`lib/analyses/run.ts` `logEvent`:** add an `else if` for each new event
   type, or `tsc` fails.
7. **`lib/config.ts` and `.env.example`:**
   - Add `getXModel = () => envModel("X_MODEL", "gemini-3.5-flash-lite")` and
     `getXThinking = () => envThinking("X_THINKING")`.
   - Add both names to `.env.example`, commented.
   - Report usage by passing `onUsage: reportUsage(emit, "x")` to the model
     call, or through `fillFields`'s `stage`. Use a new label that will never
     be renamed.
8. **Phases:**
   - A new phase goes in `DiligencePhase` (`lib/core/types.ts`) and needs a
     `STEP_ORDER` entry in `stream-state.ts`.
   - A stage that runs alongside others should set no `status`. Use
     `waitingStatus` to show a phase while a stage waits on a non-critical
     stage it needs (verdict does this for landscape).
   - An old report never reached a phase you add, so don't base a tab's
     status on `stepDone` for it; check `absent` first.
9. **`components/features/analyze/reportSections.tsx`:**
   - Add a `REPORT_SECTIONS` entry whose `available` guards against an absent
     slice.
   - Array order is the full report's order.
   - `pageOnly` keeps a section off the full report.
   - `ReportEnv` carries the PDF and slide links.
10. **`lib/products.ts`:** add a `PRODUCT_PAGES` entry for the product's own
    page, before `report`. Array order is the order of the sidebar tabs and
    the narrow-screen pills.
11. **`components/features/analyze/productTabs.tsx`:**
    - Add a `PRODUCT_TABS` entry with sections, status, summary and `absent`.
    - Add an icon to `ProductTabIcon`. Nothing checks it, and a missing one
      leaves a blank gap.
12. **`lib/analyses/markdown.ts` `renderReport`:** add a `renderX` line so MCP
    users see the product.
13. **`next.config.ts`:** if the stage reads files at run time, add
    `outputFileTracingIncludes` entries under both the `/api/analyze` and
    `/mcp` keys.
14. **Docs:** update the products and Pages tables in `features/README.md`,
    and in this file the [pipeline table](#the-pipeline), the
    [Routes](#routes) slug list, the [code map](#code-map) if you added files,
    and the [feature list](#feature-list). Then run [the checks](#checks).

## Feature list

What exists today, with known gaps. Slugs are the product page paths.

### Products

| Product | Slug | What it does | Known gaps |
| --- | --- | --- | --- |
| **Deck reader** (`deck-reader/`) | `deck` | Reads the PDF page by page (embedded text, then vision OCR) and shows each slide's image beside its text. For each slide, lists the memo fields taken from it (deck-sourced fields only). Opens a given slide with `?slide=N` | MCP runs have no stored PDF, so no slide images, and the page doesn't say why (T11). No export (T11). No fallback OCR model. The memo page itself has no slide links |
| **Memo** (`memo/`) | `memo` | The DD memo (company, team, problem, solution, market), filled from the deck (`extract`), then the gaps from the web (`complete`). Every field shows its source | Read-only; two fields say "add manually" with no way to (T5) |
| **Founders** (`founders/`) | `founders` | Founders with role and background, how they met, cap table. Filled by the memo stages | No research of its own and no per-founder sources (T3) |
| **Research** (`research/`) | `research` | Web research aimed at the deck's gaps: the searches, the sources and the notes | Its prompt hardcodes "at most 3" searches, so on Gemini it ignores `RESEARCH_MAX_SEARCHES` (landscape and the Claude fallback read it). Competitors are searched again by landscape (T16) |
| **Landscape** (`landscape/`) | `landscape` | Searches for competitors, plots 5–8 of them (at most 10) with the startup on two chosen axes, and ranks the top three with why each competes. Non-critical, so a failure leaves the rest of the report intact | No editing of axes or competitors, no rerun (T10) |
| **Scorecard** (`scorecard/`) | `scorecard` | Six 1–5 ratings plus funding raised. The page also shows the verdict | Per analysis only, no tracking across analyses (T4). Stage hand-lists the metric keys (T14) |
| **Feedback** (`feedback/`) | `feedback` | Critical, warning and strength items on the deck. Each links to the slides it cites | Its own prompt and checklist are thin and lean on the shared playbook (T17) |
| **Verdict** (`verdict/`) | (on `scorecard`) | Invest/pass from the ONNX model trained on real deal data. No LLM, no cost | — |
| **Full report** | `report` | Every section on one page, with a chapters nav | — |

### Platform

- **Dashboard** (`/dashboard`):
  - dropzone and sample deck
  - five recent analyses as cards
  - metrics: decks analysed, last 30 days, recommended (invest calls), and
    average score (the invest model's score out of 100, over the decks it
    scored)
- **Analyses list** (`/dashboard/analyses`): a dropzone, then every analysis,
  each deletable along with its stored PDF, plus clear all.
- **Inside an analysis:**
  - Each product is a sidebar tab with a status dot:
    - ready
    - running
    - didn't finish: it failed, or the run stopped before reaching it
    - not in this report: an old report from before the product, or nothing
      was found
  - The overview has one card per product.
  - Narrow screens get the tabs as pills.
- **Live runs:**
  - Streamed over NDJSON with a phase stepper.
  - A run survives moving between pages.
  - Runs started elsewhere are polled.
  - With accounts on, a deck that already has a finished analysis opens it
    instead of re-running.
- **Accounts** (Supabase):
  - Google OAuth and email/password, with password reset.
  - New runs need an account. Analyses saved under a legacy anonymous session
    are claimed on sign-in.
  - Run limit: 25 new analyses per account in a rolling 24 hours.
  - Data export (JSON plus signed deck links) and account deletion (needs
    `SUPABASE_SERVICE_ROLE_KEY`).
  - Accounts-off mode when Supabase isn't configured.
- **MCP server** (`/mcp`, OAuth):
  - `analyze_deck`: deck text in, markdown report out. Text it has already
    seen returns the saved report unless `rerun: true`. A slow run returns an
    `analysis_id` for `get_analysis`.
  - `get_analysis`
  - `list_analyses`
  - an `analyze` prompt that has Claude transcribe a deck first
- **Explainers:** `/dashboard/model` (how the invest model was trained and
  tested) and `/dashboard/rubric` (the playbook).
- **Landing page** (`/`): hero with a live dropzone and the report mock, the
  model's track record, the deck-feedback pitch (`PitchPerspective`), and the
  closing call-to-action.
- **Dev only:** a cost sidebar with per-stage cost during a live run.

## Task backlog

Each task can be handed to one agent.

- **Shared files:** composition files the task adds a line to.
- **Not alongside:** tasks that edit the same files. Don't run them at the
  same time. Every list is symmetric.
- **Paid run:** the task can't be fully verified without an analysis run.
  Ask the owner first, with the cost.

**Done:**

- The split into separately sellable products (`ecc01d3`).
- Per-slide deck feedback (`ccf6e26`).
- Cheaper Gemini calls with accurate cost tracking (`9524450`): per-stage
  thinking, per-model search pricing, response schemas.
- The full `.env.example`.

**Suggested order.** The waves are a suggestion; the "Not alongside" lists are
the rule.

- **First wave, in parallel:** T1, T2, T13, T14, and one of T4 or T5 (both
  touch `store.ts`). T3 (paid) can join, and must finish before T6 or T9
  start.
- **Second wave:** T6, then T7. While T6 runs: T9, and whichever of T4 or T5
  waited. T8 once T13 has landed and T4, T5 and T7 aren't running.
- **Third wave:** T10 (after T2, T5 and T7) and T12 (after T2).
- **Small and free, whenever their "Not alongside" tasks aren't running:**
  T11, T15, T20.
- **Paid, with the owner's OK:** T16, T17.
- **Waiting on the owner:** T18, T19.

### T1. Add a test runner and a replay test

- **Status:** open
- **Why:** nothing guards the "saved reports replay forever" rules except
  care. A replay test catches a renamed key or a broken fold for free.
- **Scope:**
  - Add vitest as a dev dependency, plus an `npm test` script.
  - Add synthetic fixtures: hand-written `ProgressEvent` streams for a full
    run and for one that stops early, plus a saved state shaped like an old
    report (no `deck`, no `landscape`, no feedback `slides`).
  - Test that `streamReducer` folds them to the expected state, and that
    `renderReport` (markdown) and every `PRODUCT_TABS` status/summary handle
    the old shape.
  - Test the pure parsers: `lib/core/parse.ts`, `features/feedback/parse.ts`,
    `features/landscape/parse.ts`, `features/deck-reader/parser.ts`, and
    `normalizeFounders` (`features/founders/form.ts`).
  - Add `npm test` to [the checks](#checks).
  - If T2's demo events have landed, replay them too.
- **Shared files:** `package.json`, `package-lock.json`, this file.
- **Start after:** —
- **Migration:** no. **Paid run:** no. Fixtures are synthetic; no real deck
  text.
- **Done when:** `npm test` passes, and it fails if a fold drops a key or a
  renderer throws on the old-report fixture.
- **Not alongside:** T20 (`package.json`).

### T2. Localhost demo mode

- **Status:** open
- **Why:** agents can't sign in or pay for runs, so today nobody can look at a
  report page while changing it. This unblocks UI work (T4, T10, T11, T12).
- **Scope:**
  - A typed, hand-written demo analysis. Proposed:
    `lib/samples/demo-events.ts`, a `ProgressEvent[]` for one complete
    synthetic company, folded with `streamReducer`.
  - Shown at `/dashboard/analyses/demo` and its product pages.
  - Only when `NODE_ENV === "development"` and Supabase is not configured.
    Gate on an inline `process.env.NODE_ENV === "development"` so a
    production build drops the demo code.
  - Optionally a second demo that stops partway, for failed/unfinished
    states.
  - Document the launch entry the owner should add (accounts-off env).
    Don't edit `.claude/launch.json` yourself.
- **Shared files:** `ReportProvider.tsx` (where the demo id resolves),
  `lib/routes.ts` if a path helper is added.
- **Start after:** —
- **Migration:** no. **Paid run:** no.
- **Done when:**
  - In accounts-off dev, every product page of the demo renders with real
    content, checked in the browser.
  - In a production build (`npm run build && npm start`, accounts off),
    `/dashboard/analyses/demo` shows not-found, and the demo company's name
    doesn't appear in `.next/static`.
- **Not alongside:** T7 (both touch `ReportProvider`/`ProductView`), T12
  (small overlap).

### T3. Founder research stage

- **Status:** open
- **Why:** founder research is one of the products to sell, but today it's
  only what the memo stages pick up.
- **Scope:**
  - A new `founders` stage in `features/founders/` (`stage.ts`,
    `prompts.ts`):
    - needs `["extract"]`, `critical: false`, web search
    - usage label `founders-search`, plus a second label (e.g. `founders`)
      if it makes a separate structuring call, as landscape does
    - `FOUNDERS_MODEL` / `FOUNDERS_THINKING` getters
    - a search budget from config, passed into the prompt. On Gemini that's a
      request, not a cap.
  - `Founder` gains optional sources/links (new keys at the end), and
    `normalizeFounders` keeps them.
  - `complete` mustn't overwrite a founders list this stage filled: merge by
    name, or skip it.
  - The founders page shows the sources.
  - Remove founder verification from research: the sentence in
    `features/research/prompts.ts`, and the founders gap in `computeGaps`
    (`form-schema.ts`).
  - Follow [Adding a product](#adding-a-product-or-a-new-stage) for the
    wiring.
- **Shared files:** `engine.ts`, `lib/diligence/types.ts`,
  `form-schema.ts`, `stream-state.ts`, `run.ts` `logEvent`, `lib/config.ts`,
  `.env.example`, `productTabs.tsx`, `markdown.ts`,
  `features/research/prompts.ts`.
- **Start after:** —
- **Migration:** no. **Paid run:** yes, one, to verify.
- **Done when:**
  - A run fills each founder with at least one web source.
  - Old analyses still render founders, without links and without errors.
  - The dev cost sidebar shows `founders-search`.
- **Not alongside:** T6, T7, T20 (`engine.ts`); T9 (`markdown.ts`); T12;
  T15; T16 (research prompt).

### T4. Scorecard tracking across analyses

- **Status:** open
- **Why:** comparing decks over time is part of the scorecard product.
- **Scope:**
  - Add the scorecard to the list query (`SUMMARY_COLUMNS` in
    `lib/analyses/store.ts`, e.g. `scorecard:state->form->scorecard`).
  - Per-metric averages in the dashboard metrics. Average only ratings above
    0.
  - Sort and filter the analyses list by score.
  - Optional: a timeline for the same company across decks.
  - A row with no scorecard, or with all six ratings at 0, reads "not
    scored", never 0.
- **Shared files:** `store.ts`, `DashboardHome.tsx`, `RecentAnalyses.tsx`.
- **Start after:** — (T2 makes it checkable in a browser).
- **Migration:** no (jsonb select). **Paid run:** no.
- **Done when:** the dashboard shows per-metric averages; the list sorts by
  score; rows without a scorecard, or with all zeros, show "not scored".
- **Not alongside:** T5 (`store.ts`), T8, T18 (`DashboardHome.tsx`), T12.

### T5. Edit memo fields by hand, and export the memo

- **Status:** open
- **Why:** the memo should be a working document, not read-only output.
- **Scope:**
  - Add `"manual"` to `FieldSource` (`lib/core/types.ts`) and to
    `SOURCE_PRIORITY` at 3 (`lib/core/parse.ts`), so models can never
    overwrite it. Keep it out of `VALID_SOURCES`, so a model can't claim it;
    only the edit path writes it.
  - Source priority guards text fields only. Founders and scorecard edits
    need a manual flag that their `FIELD_HANDLERS` check.
  - Inline editing in `MemoView`, starting with the two `manualOnly` fields.
  - Save into the row's `state` with an RLS-scoped update, only when the run
    isn't live.
  - Carry manual fields forward when a rerun upserts a fresh state: read the
    old row's manual fields before `recordFor`'s claim, keep them in the new
    state (`persist.ts`), and seed them into `ctx.form` (`engine.ts` /
    `run.ts`, which T7 also changes).
  - Export the memo as markdown or a printable page.
- **Shared files:** `lib/core/types.ts`, `lib/core/parse.ts`, `persist.ts`,
  `store.ts`, `engine.ts`, `run.ts`, `components/report/SourceBadge.tsx`,
  `lib/analyses/markdown.ts` (`SOURCE_TAG` and the legend),
  `reportSections.tsx`.
- **Start after:** —
- **Migration:** no. **Paid run:** no for editing and export; yes, one,
  optional, to prove a rerun keeps edits.
- **Done when:** an edited field shows a "manual" badge, survives a reload,
  and can't be overwritten by a model. Export downloads the memo.
- **Not alongside:** T4 (`store.ts`), T7, T8 (`persist.ts`).

### T6. Run scorecard and feedback in parallel with complete

- **Status:** open
- **Why:** the critical path is five model calls in a row (six with OCR).
  This shortens it at no extra cost.
- **Scope:**
  - `scorecard` and `feedback` need `["research"]`. Their prompts read only
    the deck and research, never `complete`'s fields.
  - `verdict` needs `["complete", "scorecard", "feedback", "landscape"]`. It
    must name `scorecard` once `feedback` no longer implies it.
  - Remove feedback's `status` (phase `"completing"`, in
    `features/feedback/stage.ts`) and set none on scorecard, since they now
    run alongside `complete`.
  - Then check that `STEP_ORDER` and `productTabs.tsx`'s phase-based statuses
    still read right when stages overlap.
- **Shared files:** `features/{scorecard,feedback,verdict}/stage.ts`,
  `engine.ts` comment, `stream-state.ts`, `productTabs.tsx`.
- **Start after:** —
- **Migration:** no. **Paid run:** yes, one. Compare cache-read tokens in the
  cost sidebar against a serial run.
- **Done when:**
  - The logs show the three calls overlapping.
  - Every tab reaches done.
  - Cache reads are no worse.
  - T1's replay tests pass, if T1 has landed.
- **Not alongside:** T3, T7, T20 (`engine.ts`); T12 (`productTabs.tsx`); T14
  (`scorecard/stage.ts`).

### T7. Rerun a single product

- **Status:** open
- **Why:** products are sold separately, so each should run on its own.
- **Scope:**
  - The engine runs only the chosen stages. Needs outside the subset count as
    met, from the seeded state.
  - Seed `ctx.form` from the saved state, and rebuild `ctx.research` as
    `{ findings: state.notes, sources: state.form.sources }`, so a
    feedback-only rerun doesn't redo research.
  - Get the deck text from the stored PDF (upload runs) or from the client
    sending it again (MCP). Not from the saved slides, which are clipped
    (6,000 characters a page, 150,000 a deck). Old reports without `deck`
    need one of those anyway.
  - Clear the rerun product's own slice first (e.g. `deckFeedback`, which
    appends).
  - A product rerun mustn't go through `recordFor`'s claim, which writes a
    fresh `initialState()` and a null `deck_path`. Update the existing row
    instead, starting the reducer from the saved state, so `report` carries
    the seeded form.
  - `/api/analyze` and `runAnalysis` take an optional product and analysis
    id.
  - A "Run again" button on each product page (`ProductView`).
  - A `product` option on MCP `analyze_deck` with `rerun`.
  - Other products' saved state stays byte-identical.
- **Shared files:** `engine.ts`, `run.ts`, `app/api/analyze/route.ts`,
  `persist.ts`, `lib/products.ts` (slug to stages), `productTabs.tsx`,
  `ProductView.tsx`, `lib/mcp/server.ts`.
- **Start after:** T6.
- **Migration:** no. **Paid run:** yes.
- **Done when:**
  - Rerunning feedback calls only the feedback model (one usage label in the
    dev sidebar).
  - Every other product's state is unchanged.
  - No product given still means a full run.
- **Not alongside:** T2, T3, T5, T6, T8, T9, T10, T12, T20.

### T8. Record cost per product, and the owner's monthly spend

- **Status:** open
- **Why:** pricing products separately needs their real cost, and today usage
  is never saved.
- **Scope:**
  - Migration `0005` or higher: a private usage table with analysis id,
    usage label, tokens, searches, `cost_usd` and time. RLS on, no user
    policies.
  - Write a row per `usage` event on the server, beside the recorder. Keep
    usage out of the user-visible `state`.
  - Map labels to products using the [pipeline table](#the-pipeline).
  - An owner-only view of 30-day spend per product. Identify the owner by a
    new env name, e.g. `OWNER_USER_ID`.
  - Service-role writes need `SUPABASE_SERVICE_ROLE_KEY`. Ask the owner how
    they want it set locally.
- **Shared files:** `run.ts` or `persist.ts`, `lib/config.ts`,
  `.env.example`, `DashboardHome.tsx`, a new migration.
- **Start after:** T13.
- **Migration:** yes. The owner applies it. **Paid run:** yes, one.
- **Done when:**
  - After one run, the table has a row per usage label with `cost_usd > 0`.
  - A normal user can't read it.
  - The owner sees spend per product.
  - The saved `state` is unchanged.
- **Not alongside:** T4, T12, T18 (`DashboardHome.tsx`); T5, T7
  (`persist.ts`); T13 (migration numbering).

### T9. Per-product MCP view

- **Status:** open
- **Why:** each product sold separately needs its own agent surface.
- **Scope:**
  - `get_analysis` takes an optional `product` (an enum of the
    `lib/products.ts` slugs) and returns only that product's markdown.
    `report`, or no product, means the whole report.
  - Move each product's renderer out of `lib/analyses/markdown.ts` into
    `features/<product>/markdown.ts`. Keep them pure.
    - A renderer that needs `domainOf` (`lib/sources`) or `formatGauge`
      can't live in a pure top-level file. Move the helper into `lib/core`,
      or keep that renderer out of the pure files.
    - The memo renderer takes the sections as an argument.
    - Deck and research have no renderer today. Write them (research: its
      notes and searches).
  - `renderReport` becomes a composition list.
- **Shared files:** `lib/mcp/server.ts`, `lib/analyses/markdown.ts`.
- **Start after:** —
- **Migration:** no. **Paid run:** no. Render saved state, or T1/T2
  fixtures.
- **Done when:**
  - `product: "landscape"` returns only the landscape.
  - No product returns today's report byte for byte.
- **Not alongside:** T3 (`markdown.ts`), T7 (`server.ts`), T15 (`markdown.ts`).

### T10. Edit the landscape, and rerun it

- **Status:** open
- **Why:** the landscape is a product a VC will want to adjust.
- **Scope:**
  - Edit the axis labels; add, remove or move competitors.
  - Save into both `state.landscape` and `state.form.landscape`, using T5's
    save path. Readers prefer the top-level copy.
  - A "rerun with these competitors" action, once T7 can rerun one product.
- **Shared files:** `features/landscape/*`, `reportSections.tsx`.
- **Start after:** T5 (saving edits), T7 (rerun), T2 (to see it).
- **Migration:** no. **Paid run:** no for editing; yes for the rerun.
- **Done when:** edits survive a reload and show in the MCP markdown; rerun
  uses the edited list.
- **Not alongside:** T7, T12, T15 (landscape UI imports).

### T11. Deck reader: export, and explain missing slide images

- **Status:** open
- **Why:** the deck reader should stand alone as a product page.
- **Scope:**
  - When there's no stored PDF (the `pdf` prop is null, as for MCP runs), the
    deck page says images aren't available and why. Key off `pdf`, not
    `via`: the sample deck is `via: "provided"` but has a stored PDF.
  - Better wording for the unplaced-text block.
  - An export of the slide-by-slide text (markdown download).
- **Shared files:** `features/deck-reader/ui/*`.
- **Start after:** — (T2 makes it checkable).
- **Migration:** no. **Paid run:** no.
- **Done when:** a text-only analysis's deck page explains the missing
  images; PDF analyses are unchanged; the export downloads every slide.
- **Not alongside:** T12.

### T12. Loading, empty and mobile states

- **Status:** open
- **Why:** polish across every page before selling.
- **Scope:**
  - Skeletons while a report loads.
  - Every product's empty, "didn't finish" and "not in this report" states
    (`ProductView`, `AnalysisFrame`).
  - An empty dashboard and list.
  - Phone-width layout of each page (16px gutter, no horizontal scroll).
- **Shared files:** `components/features/analyze/*`,
  `components/app-shell/*`.
- **Start after:** T2.
- **Migration:** no. **Paid run:** no.
- **Done when:** every page and state is checked at 375px and at desktop
  width, with screenshots.
- **Not alongside:** T2, T3, T4, T6, T7, T8, T10, T11, T18. Or split it by
  page with the owner.

### T13. Backfill the two migrations that are live but not in the repo

- **Status:** open
- **Why:** the repo should rebuild the live schema.
- **Scope:** add `supabase/migrations/0003_early_access.sql` and
  `0004_deal_stage.sql`, matching what's live exactly. Live versions are
  `20261015024950` and `20261015031919`.
  - **`early_access_requests`:**
    - `id uuid` primary key, default `gen_random_uuid()`
    - `email text`, unique, length 3–254
    - `interests text[]`, default `'{}'`, at most 4 entries
    - `created_at timestamptz`, default `now()`
    - RLS enabled
  - **`analyses.stage`** `text not null default 'new'`, constrained to
    `new`, `shortlisted`, `dd_sent`, `follow_up`, `invested`, `passed`.
  - **`analyses.stage_changed_at`** `timestamptz`.
  - Read the exact statements, read-only, from
    `supabase_migrations.schema_migrations` if you have Supabase access.
    Otherwise ask the owner. Apply nothing.
  - Add both to the row types in `lib/supabase/types.ts` if code will read
    them.
- **Shared files:** `supabase/migrations/`.
- **Start after:** —
- **Migration:** files only, already live. **Paid run:** no.
- **Done when:** the files match live statement for statement.
- **Not alongside:** T8 (migration numbering).

### T14. Scorecard stage uses `SCORECARD_METRIC_KEYS`

- **Status:** open
- **Why:** one source of truth for the six metrics.
- **Scope:**
  - Replace `METRICS` in `features/scorecard/stage.ts` with
    `[...SCORECARD_METRIC_KEYS, "funding"]` (`features/scorecard/form.ts`),
    and keep the apply loop the same.
  - The prompt and `SCORECARD_SCHEMA` don't read `METRICS`, so leave them. If
    you generate either from the keys, diff the output byte for byte.
  - `ScorecardPanel.tsx` and `prompts.ts` also list the keys. Leave them, and
    note them as a Follow-up.
- **Shared files:** —
- **Start after:** —
- **Migration:** no. **Paid run:** no.
- **Done when:** `features/scorecard/stage.ts` has no hand-listed metric
  keys; the checks pass.
- **Not alongside:** T6 (`scorecard/stage.ts`), T15.

### T15. Stop re-exporting product types from `lib/diligence`

- **Status:** open
- **Why:** the re-exports let a product reach another product's types, which
  lint can't catch.
- **Scope:**
  - Point product UI files at their own `features/<product>/types`.
  - Give `ScorecardPanel` a narrow prop type instead of the full form.
  - `markdown.ts` imports `SCORECARD_METRIC_KEYS` from
    `features/scorecard/form`.
  - Delete the unused re-exports in `lib/diligence/types.ts` and
    `form-schema.ts`.
  - Add a lint rule banning `features/**` from importing `@/lib/diligence/*`
    values.
    - `KERNEL_ONLY` (`eslint.config.mjs`) already covers the pure top-level
      files, so the new rule is for `ui/` and `stage.ts`.
    - Exclude `stage.ts`: the memo, research and scorecard stages import
      `applyField`, `FIELD_DESCRIPTORS` and `computeGaps`.
    - Two UI files import `form-schema` values:
      `features/deck-reader/ui/selectors.ts` (`FIELD_DESCRIPTORS`,
      `readField`) and `features/memo/ui/MemoView.tsx` (`DOC_SECTIONS`,
      `readField`, `sectionSlug`). Pass these in as props from composition,
      or exclude those files. Say which you chose.
  - Update the note in `features/README.md`.
- **Shared files:** `lib/diligence/types.ts`, `form-schema.ts`,
  `eslint.config.mjs`.
- **Start after:** —
- **Migration:** no. **Paid run:** no.
- **Done when:** the new rule fails on a deliberate violation; the checks
  pass.
- **Not alongside:** T3, T9, T10, T14.

### T16. Honor `RESEARCH_MAX_SEARCHES`, and drop the duplicate competitor search

- **Status:** open
- **Why:** searches bill once past the free allowance, and the prompt ignores
  the knob.
- **Scope:**
  - `features/research/stage.ts` reads `getResearchMaxSearches()` and passes
    it to the prompt builder, the way landscape does. (`prompts.ts` is pure
    and can't import `lib/config`.) The prompt then states that number
    instead of a hardcoded "at most 3".
  - `RESEARCH_MAX_SEARCHES` also caps landscape today. To set research to 1
    without capping landscape, add `LANDSCAPE_MAX_SEARCHES` (default 3) and
    switch `features/landscape/stage.ts` to it.
  - Drop the competitor part of the research prompt, which landscape already
    covers. But landscape's findings reach neither `complete` nor
    `scorecard`. First pass them along through composition, or keep a short
    competitor note in research.
- **Shared files:** `lib/config.ts`, `.env.example` if a knob is added.
- **Start after:** —
- **Migration:** no. **Paid run:** yes, one.
- **Done when:**
  - The prompt states the configured number.
  - With `RESEARCH_MAX_SEARCHES=1`, the logs show one research search. On
    Gemini that's a request, so check it.
  - `market.competitiveLandscape` and the other market fields still fill.
  - Landscape is unchanged.
- **Not alongside:** T3.

### T17. Expand the feedback playbook

- **Status:** open
- **Why:** feedback is sold on its own, but it leans on the shared playbook,
  which a comment in `features/feedback/prompts.ts` calls "still thin".
- **Scope:**
  - Expand the instructions in `features/feedback/prompts.ts` and the list in
    `checklist.ts`.
  - Keep the `slides` citation instruction.
  - Don't touch `docs/playbook.md`, which every stage shares.
- **Shared files:** —
- **Start after:** —
- **Migration:** no. **Paid run:** yes, one or two on the sample deck.
- **Done when:**
  - The prompt asks for each item's category to be a checklist label.
  - One run covers every category with at least one item. With 10
    categories that means raising the 5–10 item cap, which costs output
    tokens, so ask the owner or agree a lower target.
  - Nothing fails to parse.
- **Not alongside:** —

### T18. Remove the old localStorage import

- **Status:** open (the owner confirms the date)
- **Why:** dead migration code. It's marked temporary, and is the only caller
  of anonymous sign-in.
- **Scope:**
  - Delete `components/features/auth/LegacyImportPrompt.tsx`,
    `lib/analyses/legacy.ts` and their mount points.
  - Check whether `ensureAnonymous` and `claim_anonymous_analyses` still have
    callers. Report this, but don't drop the SQL function.
- **Shared files:** `DashboardHome.tsx`, `AnalysisWorkspace.tsx`.
- **Start after:** the owner's go-ahead.
- **Migration:** no. **Paid run:** no.
- **Done when:** grep finds no legacy import; the checks pass.
- **Not alongside:** T4, T8 (`DashboardHome.tsx`), T12, T19.

### T19. Apple and LinkedIn sign-in

- **Status:** open (the owner must enable the providers in Supabase first)
- **Why:** SaaS onboarding. Today it's Google only.
- **Scope:**
  - `components/features/auth/providers.ts`, the provider icons, and the
    sign-in UI.
  - `ProviderIcon.tsx` draws only Google; give it a provider prop.
  - Apple needs a paid Apple Developer account and domain verification (see
    the note in `providers.ts`). Whether to pay for that is the owner's call.
- **Shared files:** —
- **Start after:** the owner's provider setup.
- **Migration:** no. **Paid run:** no.
- **Done when:** both buttons render and start OAuth. The owner completes a
  real sign-in.
- **Not alongside:** T18.

### T20. Fix stale docs and comments

- **Status:** open
- **Why:** wrong docs mislead the next agent.
- **Scope:**
  - **`README.md`:**
    - Node 22+, not v18+.
    - Remove `WRITER_PROVIDER` and `RESEARCH_PROVIDER`; models pick the
      provider.
    - The clone URL is `william-ragnarsson/sevenfold`, and the next line is
      `cd sevenfold`.
    - Gemini, not Claude, writes the memo.
    - The "last updated" line.
  - **`lib/diligence/engine.ts` doc comment:** six ratings, not seven, and
    the current stage graph. If T6 is in flight, fix this after it lands.
  - **`features/memo/stage.ts` comment:** it says "the scorecard included",
    which is no longer true.
  - **`app/api/analyze/route.ts` and the top of `lib/analyses/persist.ts`:**
    the comments say a run carries on after the browser disconnects. It's
    aborted and saved as failed.
  - **`package.json`:** add `"engines": { "node": ">=22" }`.
  - **Tell the owner,** don't edit: `NICRRON_API_KEY` in their `.env` is read
    by nothing.
- **Shared files:** `lib/diligence/engine.ts` (doc comment), `package.json`.
- **Start after:** —
- **Migration:** no. **Paid run:** no.
- **Done when:** none of the listed stale lines remain; the checks pass.
- **Not alongside:** T1 (`package.json`), T3, T6, T7 (`engine.ts`).
