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

## How to work here

The owner says in each session what to work on. This file is the rest of the
context: what exists, how it's built, where things go, and the rules that keep
the products apart.

1. **Read the [code map](#code-map) for the area you're changing**, and
   [the rules](#rules-for-every-change). Before a product change, also read
   `features/README.md`. A new product or stage follows
   [Adding a product](#adding-a-product-or-a-new-stage). Anything else follows
   [Adding something that isn't a product](#adding-something-that-isnt-a-product).
2. **Ask the owner first** if the scope is unclear, or if checking the work
   needs a paid analysis run ([Cost](#cost-the-owner-pays-for-every-model-call)).
3. **Other sessions may be working on other branches at the same time.** Touch
   only the files your change needs. The shared composition files take a line
   or two per product, which keeps merges small.
4. **Before you report back,** update this file so it describes the project
   with your change in it ([Keep this file current](#keep-this-file-current)),
   then run [the checks](#checks). The owner may open the PR straight from
   your report, so don't leave the update for later.
   - Say exactly what you verified and how.
   - Say what you couldn't verify, and why.

## Code map

Products build on `lib/core`. Their `stage.ts` and `ui/` may import the rest
of `lib/` too; in practice that's `lib/config`, `lib/llm`, `lib/invest`,
`lib/sources`, `lib/routes`, `lib/diligence`'s composite types and field
helpers, and the `PdfSource` type (`lib/analyses/pdf-source`). The composition layer
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
| `lib/analyses/` | Runs and storage. `run.ts` (one analysis end to end), `persist.ts` (server writer, rate limits), `store.ts` (browser reads and deletes under RLS, plus signed deck URLs), `markdown.ts` (the report as markdown, for MCP), `status.ts`, `hash.ts`, `pdf-source.ts`, `pending-deck.ts`, `legacy.ts`. The list views never load `state`: `SUMMARY_COLUMNS` (`store.ts`) pulls only `startedAt` and `verdict` out of the jsonb, so anything else a list row or dashboard metric shows must be added there as a jsonb path |
| `lib/llm/` | Provider adapters (`gemini.ts`, `claude.ts`) and `pricing.ts` |
| `lib/config.ts` | Almost every env var, each read through a getter: model per stage, thinking per stage, token and search budgets, Supabase keys. Exceptions: `NEXT_PUBLIC_SITE_URL` is read directly in `app/layout.tsx` and `lib/mcp/server.ts`, and `proxy.ts` reads the `NEXT_PUBLIC_SUPABASE_*` vars itself |
| `lib/playbook/load.ts` | `loadPlaybook()`: reads `docs/playbook.md` from disk at run time, once per process |
| `lib/sources.ts` | `domainOf` and `faviconOf`. The only `lib` module besides `lib/core` that `components/report` and `components/ui` may import |
| `lib/mcp/` | The MCP tools and prompt (`server.ts`) and the OAuth metadata (`metadata.ts`) |
| `lib/invest/` | The verdict's ONNX model (`model.onnx`, `model.ts`) and the numbers behind `/dashboard/model` |
| `lib/products.ts` | The pages an analysis has (slug, label, description), in sidebar order |
| `lib/routes.ts` | Page paths and page lists only: `ROUTES`, `analysisPath`, `deckSlidePath`, `signInPath`, `safeNext`, `isDashboardPath` (what `proxy.ts` gates), `DASHBOARD_PAGES` (the sidebar's dashboard links), `PRODUCTS` (the nav bar's Products menu), and the slide param helpers. API, `/auth/*` and `/mcp` paths are written inline where they're used, and `supabase/templates/*.html` hardcode `/auth/confirm`, `/dashboard` and `/dashboard/account/password` |
| `lib/samples/airbnb.ts` | The sample deck, pre-transcribed so it skips OCR |
| `lib/supabase/` | Browser, server, admin and bearer-token clients, plus row types |
| `components/features/analyze/` | UI composition and the analysis shell. `AnalysisProvider` (the live run), `ReportProvider` (the open analysis), `reportSections.tsx` (section registry), `productTabs.tsx` (each page's sections, status and summary). `AnalysisLauncher` (every dropzone), `AnalysisFrame` (the layout around every analysis page: loading and missing states, the dev cost sidebar), `AnalysisOverview`, `ProductView`, `ReportView`, `useLiveRun`, `DevCostSidebar`. `DashboardHome` (dropzone, five recent cards, metrics), `RecentAnalyses` (the full list with delete and clear all, on `/dashboard/analyses` and `/dashboard/account`), `AnalysisWorkspace` (the `/dashboard/analyses` body) |
| `components/app-shell/` | Dashboard layout and sidebar. The sidebar swaps to an analysis's tabs when one is open |
| `components/features/{auth,hero,landing,model}/` | Sign-in and accounts, the landing page, and the `/dashboard/model` explainer |
| `components/report/`, `components/ui/` | Shared primitives (`Row`, `Skeleton`, `SourceBadge`, `SourceLegend`, `SourceRow`, `SearchList`; `Card`, `Dropzone`). The only components a product's `ui/` may import |
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
| `/dashboard` | Dropzone (plus the legacy import prompt), the five most recent analyses as cards, and "at a glance" metrics |
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
     `initialState()` and `deck_path` null, then uploads the PDF and sets
     `deck_path`. So a rerun replaces the whole saved report, every product's
     slice included. To change one product's saved data, update the row
     instead of going through `recordFor`.
   - It returns a `SupabaseRecorder`. With no owner (accounts off), or when
     that upsert fails, it returns `NOOP_RECORDER` instead, and the browser
     run carries on unsaved. A failed PDF upload only leaves the row without a
     deck. Over the limit it throws `RateLimitError`.
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
   saved as failed, with what it got through. Comments in
   `app/api/analyze/route.ts` and `lib/analyses/run.ts` say the run outlives
   the disconnect ([Known issues](#known-issues)).
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
- The markdown leaves out the deck's slides and research's notes and searches
  (research shows only as its sources, at most 25, `MAX_SOURCES`), and drops
  feedback items' slide citations.

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
- Verdict reads `form.scorecard` but doesn't list `scorecard` in its `needs`.
  It runs after scorecard only because it needs `feedback`, which needs
  `scorecard`. If you change either stage's `needs`, add `scorecard` to
  verdict's. It waits for landscape only so the report goes out with it, and
  doesn't read it.
- `scorecard` and `feedback` send only the playbook, the deck and research's
  notes, never the filled form. Their `needs` (`complete`, `scorecard`) only
  set the order.
- Research and landscape both search for competitors. Landscape's findings
  reach no other stage: `complete` sees research's notes and sources, and
  `scorecard` and `feedback` its notes only.
- Phases come only from extract (`extracting`), research (`researching`),
  complete (`completing`), verdict (`verdict`) and the engine's closing
  `done`. Feedback's `status` and verdict's `waitingStatus` reuse
  `completing`; scorecard and landscape set none. So the stepper reads
  "Completing form", and the memo and founders tabs read running, until
  verdict starts.
- `RESEARCH_MAX_SEARCHES` (`getResearchMaxSearches()`) sets landscape's
  search budget and the Claude adapter's `max_uses`. Research's own prompt
  ignores it and says "at most 3".
- A critical failure aborts the whole run. A non-critical one is reported
  through the stage's `onError`.

### Saved data worth knowing

- Saved slides are clipped: 6,000 characters a slide and 150,000 a deck
  (`MAX_SLIDE_CHARS`, `MAX_DECK_STATE_CHARS` in
  `features/deck-reader/state.ts`). For the full deck text, use the stored PDF.
  MCP's `deck_text` is capped at 150,000 characters too.
- Whether slide images exist depends on the stored PDF (the `pdf` prop), not
  on `deck.via`. The sample deck is `via: "provided"` but has a stored PDF;
  MCP runs have none.
- Three slices are saved twice, at the top level of `state` and inside
  `state.form`: `verdict`, `deckFeedback` and `landscape` (the `report` case
  in `stream-state.ts` copies them up). Readers prefer the top-level copy
  (`markdown.ts`), because a run that stops short never sends `report`.
- `ctx.research`, which complete, scorecard and feedback read, isn't saved.
  Its findings are, near enough, `state.notes` (the `note` events joined). Its
  sources are `form.sources`, a direct `ctx.form` write with no event of its
  own, so before the `report` event (or in a run that stopped short) they
  exist only in `state.searches`.
- Field sources are `deck`, `web`, `inferred` and `unknown` (`FieldSource`,
  `lib/core/types.ts`). A source a model sends that isn't in `VALID_SOURCES`
  is stored as `inferred`. `applyTextField` (`lib/core/parse.ts`) won't
  overwrite a filled text cell with a lower-ranked source (`SOURCE_PRIORITY`:
  deck = web > inferred > unknown). `FIELD_HANDLERS` entries have no such
  guard: each `founders` line replaces the whole list (an empty or malformed
  one empties it), and `complete` is asked for the whole form, so it can
  re-emit `founders` after `extract`. Any `scorecard.*` line overwrites that
  rating.
- `normalizeFounders` (`features/founders/form.ts`) rebuilds each founder from
  `role`, `name`, `commitment` and `background` only, so a key added to
  `Founder` is dropped unless it's added there too.
- An unscored scorecard has every rating at 0 and funding `null`. With
  `fundingInUsd` set (top-level state), funding is whole US dollars, `null`
  means unknown and `0` means confirmed nothing raised. Older reports lack
  the flag: there `0` meant unknown and amounts are in the deck's currency.
  `ScorecardPanel`'s `legacyFunding` and `formatFunding` in `markdown.ts`
  show them as they were.
- `company.source` and `company.personalNote` are `manualOnly`. They're still
  in the field list `extract` and `complete` send. The extract prompt and
  their hints ask the model to leave them out, but no code stops a value
  landing there (`applyTextField` doesn't check `manualOnly`), and the memo
  and the markdown show one if it does. `computeGaps` skips them.

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
- Products never import `app/`. From `components/`, only a product's `ui/`
  may import, and only `components/report` and `components/ui`; `stage.ts`
  and `pdf/` import nothing from `components/`.
- `lib/core` imports only itself, `lib/llm` and `lib/config`.
  `components/report` and `components/ui` import only each other, `lib/core`
  and `lib/sources`. None of the three knows a product.
- Write `@/` imports without `./` or `../` inside them.
- New product folders are picked up by lint automatically.

Lint doesn't catch a product reaching another product's types or values
through the `@/lib/diligence/*` re-exports (the product types in `types.ts`,
`SCORECARD_METRIC_KEYS` in `form-schema.ts`). Don't do it.

### Saved reports replay forever

Old analyses are their saved `state` jsonb, replayed by today's code. So:

- **Never rename** any of these:
  - event `type` strings
  - form or state keys
  - the top-level `startedAt` and `verdict`, which SQL reads
- **Never rename a usage label either.** Labels aren't saved, but the server
  log, the dev cost sidebar and anything that tracks cost key on them.
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
- A stage that searches the web takes its budget from config and passes it to
  its prompt builder, never a number written into the prompt. Landscape does
  this with `getResearchMaxSearches()`. Research doesn't: its prompt says
  "at most 3".
  - On Gemini the budget is only a request in the prompt. Only the Claude
    adapter enforces a cap: `max_uses` in `lib/llm/claude.ts`, which reads
    `getResearchMaxSearches()` itself on every search call, whatever the
    stage asked for.
  - A product's `prompts.ts` is pure and can't import `lib/config`, so read
    the budget in its `stage.ts`.

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
- **Schema drift:** live has two migrations the repo doesn't. No code reads
  either, and neither is in `lib/supabase/types.ts`.
  - `20261015024950`: table `early_access_requests` (`id uuid` primary key
    defaulting to `gen_random_uuid()`, `email text` unique and 3–254
    characters, `interests text[]` defaulting to `'{}'` with at most 4
    entries, `created_at timestamptz` defaulting to `now()`), RLS on.
  - `20261015031919`: `analyses.stage text not null default 'new'`, one of
    `new`, `shortlisted`, `dd_sent`, `follow_up`, `invested`, `passed`; and
    `analyses.stage_changed_at timestamptz`.
  - `0003` and `0004` are kept for backfilling these, so number a new
    migration `0005` or higher. A backfill must match live exactly. The exact
    statements are in `supabase_migrations.schema_migrations` on the live
    project: read them only, or ask the owner. Apply nothing.
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
- There's no JS test runner. If you add one, add its command here.
- If you changed `ml/`, also run the Python model tests:
  `cd ml && uv run pytest -q`.

### Checking UI in a browser

Use the preview tool's "Next.js dev server" config (port 3000), not a shell
command. Don't edit `.claude/launch.json` without asking the owner.

- `/dashboard` is gated, and a browser agent can't sign in. Free to check:
  `/`, `/sign-in`, and the landing page's report mock.
- With accounts off, the dashboard shell, `/dashboard/model` and
  `/dashboard/rubric` render too.
  - Accounts-off mode means Supabase env blanked:
    `NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= npm run dev`.
    This should work but hasn't been tried.
  - It needs a launch entry the owner adds.
  - Nothing is saved, but a run still costs money.
- There's no demo mode, so saved report pages can't be checked without real
  data. Say so instead of guessing.

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
  - `docs/playbook.md` breaks this rule ([Known issues](#known-issues)).
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

### Keep this file current

This file describes the project as it is on its branch. Update it with every
change, before you report back, so the branch is ready for a PR whether you
or the owner opens it.

- Fix the lines your change made wrong, and add lines for what it added.
  Search this file for each file, function and key your change touched, and
  look at the code map, routes, how a run works, the pipeline table and notes,
  saved data, the rules, the feature list and its known gaps, the "Not
  built" line, and the known issues.
- If products or pages changed, update the tables in `features/README.md`
  too.
- Edit in place. This isn't a changelog: no history, dates, "recent changes"
  section, or wording that only makes sense against an older version of the
  code ("now", "today", "recently", "used to"). Git has the history.
- Remove a known gap or known issue once it's fixed. Add one for anything you
  found but didn't fix, and tell the owner about it as well.
- When a merge conflicts in this file, keep both sides' updates.

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
   - Not every product has every file: memo and founders have no
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
   - Keys that aren't plain text cells need a `FIELD_HANDLERS` entry. It
     skips source priority ([Saved data](#saved-data-worth-knowing)), so add
     your own check if earlier values must survive a later stage.
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
    and the [feature list](#feature-list)
    ([Keep this file current](#keep-this-file-current)). Then run
    [the checks](#checks).

### Adding something that isn't a product

- **A dashboard page:** `app/dashboard/<page>/page.tsx`, its path in
  `ROUTES`, and a `DASHBOARD_PAGES` entry if it needs a sidebar link
  (`lib/routes.ts`). `proxy.ts` gates it with no change.
- **An API route:** `app/api/<name>/route.ts`. It checks the user itself,
  with `requireAccount()` (`lib/analyses/persist.ts`) or
  `supabase.auth.getUser()` as `/api/account/*` do.
- **An MCP tool:** a `registerTool` call in `lib/mcp/server.ts`. OAuth-client
  tokens must still not delete analyses or touch the `decks` bucket
  ([Database](#database)).
- **UI:** a primitive that knows no product goes in `components/report` or
  `components/ui`. A page's own components go in `components/features/<area>/`.
  UI that combines products goes in `components/features/analyze`, never in a
  product's `ui/`.
- **Server code that combines products' output** goes in `lib/diligence` or
  `lib/analyses`, never in a product.
- **A field source:** add it to `FieldSource` (`lib/core/types.ts`),
  `SOURCE_PRIORITY` (`lib/core/parse.ts`), `SOURCE_BADGE`
  (`components/report/SourceBadge.tsx`, which also drives `SourceLegend`),
  and in `lib/analyses/markdown.ts` both `SOURCE_TAG` and the legend sentence
  at the end of `renderReport`. If models may send it, also add it to
  `VALID_SOURCES` and to the memo prompt's `source` list
  (`features/memo/prompts.ts`). `tsc` catches the `Record<FieldSource, …>`
  maps, not the legend, `VALID_SOURCES` or the prompt.
- **A sign-in provider:** an `AUTH_PROVIDERS` entry
  (`components/features/auth/providers.ts`). `SignInCard` shows
  `ProviderIcon` on every provider's button, and `ProviderIcon` takes no
  props and draws only Google's mark, so it needs to take the provider. The
  owner must enable the provider on the Supabase project first.

Then update this file ([Keep this file current](#keep-this-file-current)).

## Feature list

What exists, with known gaps. Slugs are the product page paths.

### Products

| Product | Slug | What it does | Known gaps |
| --- | --- | --- | --- |
| **Deck reader** (`deck-reader/`) | `deck` | Reads the PDF page by page (embedded text, then vision OCR) and shows each slide's image beside its text. For each slide, lists the memo fields taken from it (deck-sourced fields only). Opens a given slide with `?slide=N` | MCP runs have no stored PDF, so no slide images, and the page doesn't say why. Not in the MCP markdown. No export. No fallback OCR model. The memo page itself has no slide links |
| **Memo** (`memo/`) | `memo` | The DD memo (company, team, problem, solution, market), filled from the deck (`extract`), then the gaps from the web (`complete`). Every field shows its source | Read-only: the two `manualOnly` fields say "add manually" with no way to. No export |
| **Founders** (`founders/`) | `founders` | Founders with role and background, how they met, cap table. Filled by the memo stages. Research's prompt also verifies the founders, and `computeGaps` (`form-schema.ts`) adds a founders gap when the list is empty | No research of its own and no per-founder sources |
| **Research** (`research/`) | `research` | Web research aimed at the deck's gaps: the searches, the sources and the notes | Its prompt hardcodes "at most 3" searches, so on Gemini it ignores `RESEARCH_MAX_SEARCHES`. Competitors are searched again by landscape. Its notes and searches aren't in the MCP markdown, only its sources |
| **Landscape** (`landscape/`) | `landscape` | Searches for competitors, plots 5–8 of them (at most 10) with the startup on two chosen axes, and ranks the top three with why each competes. Non-critical, so a failure leaves the rest of the report intact | No editing of axes or competitors, no rerun. Its findings don't reach the memo or the scorecard |
| **Scorecard** (`scorecard/`) | `scorecard` | Six 1–5 ratings plus funding raised. The page also shows the verdict | Per analysis only, no tracking across analyses. The rating keys are listed by hand in `stage.ts` and `prompts.ts` (both with `funding`), `ui/ScorecardPanel.tsx` and `lib/invest/model.ts`, rather than read from `SCORECARD_METRIC_KEYS` (`form.ts`, the six ratings without `funding`) |
| **Feedback** (`feedback/`) | `feedback` | Critical, warning and strength items on the deck (the prompt asks for 5–10). Each links to the slides it cites | Its own prompt and its checklist (`checklist.ts`, 10 categories, read only by the prompt) are thin and lean on the shared playbook. Nothing in code caps the item count; only the reply's `WRITE_MAX_TOKENS` budget limits it. The MCP markdown drops the slide links |
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
  - Google OAuth and email/password, with password reset. `AUTH_PROVIDERS`
    (`components/features/auth/providers.ts`) lists only Google. Apple would
    need a paid Apple Developer account and domain verification.
  - New runs need an account. Analyses saved under a legacy anonymous session
    are claimed on sign-in, through the `claim_anonymous_analyses` SQL
    function (migration `0001`, called from `AuthProvider`).
  - The import from the old localStorage (`LegacyImportPrompt`,
    `lib/analyses/legacy.ts`, mounted in `DashboardHome` and
    `AnalysisWorkspace`) is temporary, and the owner decides when it goes.
    It's the only caller of anonymous sign-in (`ensureAnonymous`).
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

Not built: rerunning a single product, saved usage or cost history, a demo
mode, and JS tests.

### Known issues

- `README.md` is out of date:
  - It says Node v18+; the project needs 22 or newer.
  - It sets `WRITER_PROVIDER` and `RESEARCH_PROVIDER`, which nothing reads.
    Each stage's model picks its provider.
  - Its clone URL and `cd` name `william-popmie/vc-analyst`; the repository is
    `william-ragnarsson/sevenfold`.
  - It says Claude writes the memo; Gemini does.
  - Its "Last updated" line.
- `package.json` has no `engines` field, though Node 22 is required.
- The doc comment in `lib/diligence/engine.ts` calls the scorecard "the seven
  ratings the invest model reads". The model reads seven values, but only six
  are ratings; the seventh is funding.
- The extract stage's comment (`features/memo/stage.ts`) says it covers the
  scorecard. Its prompt skips the scorecard fields, which the scorecard stage
  fills.
- The `enqueue` comment in `app/api/analyze/route.ts` ("the run itself
  carries on") and the `send` comment in `lib/analyses/run.ts` (a
  disconnected client "should still find a finished analysis waiting") say a
  browser run outlives the disconnect. `/api/analyze` passes `req.signal`, so
  the run is aborted and saved as failed with what it got through. The top of
  `lib/analyses/persist.ts` (a closed tab "no longer loses the work") holds
  only for that partial state.
- The doc comment in `features/feedback/checklist.ts` and the comment above
  `EXPECTED_DECK_CHECKLIST` in `features/feedback/prompts.ts` say the homepage
  shows the checklist. Only the feedback prompt reads it.
- `docs/playbook.md` is in `outputFileTracingIncludes` only under `/mcp`,
  though `/api/analyze` reads it too (`loadPlaybook()` in
  `lib/analyses/run.ts`). Tracing may follow its literal `process.cwd()` path
  on its own, but that's unconfirmed.
- The live database has two migrations the repo lacks
  ([Database](#database)).
