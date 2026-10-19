import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccount, SignInRequiredError } from "@/lib/analyses/persist";
import { isStalled, runStartedAt } from "@/lib/analyses/status";
import { applyMemoEdit, MAX_EDITED_VALUE, PICKABLE_SOURCES, type MemoEdit } from "@/lib/diligence/edits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loose bounds on a request; `applyMemoEdit` trims an edit to the real limits. */
const MAX_LIST = 50;

const founder = z.object({
  role: z.string().max(MAX_EDITED_VALUE),
  name: z.string().max(MAX_EDITED_VALUE),
  commitment: z.string().max(MAX_EDITED_VALUE),
  background: z.array(z.string().max(MAX_EDITED_VALUE)).max(MAX_LIST),
  source: z.enum(["deck", "web", "inferred", "unknown", "personal"]).optional(),
});

const body = z.object({
  /** The run the edit was made against; a rerun since then has replaced it. */
  startedAt: z.number().nullable(),
  edit: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("field"),
      key: z.string().max(100),
      value: z.string().max(MAX_EDITED_VALUE * 2).optional(),
      source: z.enum(PICKABLE_SOURCES).optional(),
    }),
    z.object({ kind: z.literal("founders"), members: z.array(founder).max(MAX_LIST) }),
  ]),
});

/**
 * Save one edit to a memo: `{ startedAt, edit }` in, `{ form }` (the saved
 * form) out. The edit is applied to the row's own fresh state rather than the
 * browser's copy, so edits from two tabs don't undo each other, and the
 * browser's live state (usage events and all) is never written back.
 *
 * Uses the cookie session, so RLS ("own analyses") scopes the row and MCP's
 * bearer tokens can't reach it.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let owner;
  try {
    owner = await requireAccount();
  } catch (err) {
    if (err instanceof SignInRequiredError) {
      return NextResponse.json({ error: "Sign in to edit an analysis." }, { status: 401 });
    }
    throw err;
  }
  if (!owner) {
    return NextResponse.json({ error: "Accounts are off, so edits can't be saved." }, { status: 409 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That edit isn't valid." }, { status: 400 });
  const { startedAt } = parsed.data;
  const edit: MemoEdit = parsed.data.edit;

  const { supabase, userId } = owner;
  const { data: row, error: readError } = await supabase
    .from("analyses")
    .select("id, status, state, created_at")
    .eq("user_id", userId)
    .eq("deck_hash", id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!row?.state) return NextResponse.json({ error: "No such analysis." }, { status: 404 });

  const state = row.state;
  const claim = state.startedAt ?? null;
  // A run still going flushes its own state every few seconds, which would
  // undo the edit.
  if (row.status === "running" && !isStalled(row.status, runStartedAt(claim, row.created_at))) {
    return NextResponse.json({ error: "This analysis is still running. Edit it once it's done." }, { status: 409 });
  }
  if (claim !== startedAt) {
    return NextResponse.json({ error: "This analysis was run again since you opened it. Reload to edit it." }, { status: 409 });
  }

  const nameBefore = state.form.company.name.value;
  if (!applyMemoEdit(state.form, edit)) return NextResponse.json({ form: state.form });
  const name = state.form.company.name.value.trim();

  let update = supabase
    .from("analyses")
    .update({ state, ...(name && name !== nameBefore.trim() && { name }) })
    .eq("id", row.id);
  // The same guard the recorder writes under: a rerun that claimed the row
  // between the read and this write wins.
  update = claim === null ? update.is("state->>startedAt", null) : update.eq("state->>startedAt", String(claim));
  const { data: written, error: writeError } = await update.select("id");
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });
  if (!written?.length) {
    return NextResponse.json({ error: "This analysis was run again since you opened it. Reload to edit it." }, { status: 409 });
  }
  return NextResponse.json({ form: state.form });
}
