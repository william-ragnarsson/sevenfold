import type { ReactNode } from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { FieldSource } from "@/lib/core/types";
import { DOC_SECTIONS, readField, type FieldDescriptor } from "@/lib/diligence/form-schema";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import { citedSlides } from "@/lib/diligence/evidence";
import { founderSource } from "@/features/founders/form";

/**
 * The memo as a PDF document, for `@react-pdf/renderer`. Only
 * `MemoExportButton` loads it, on click, so the library stays out of the
 * page's bundle. It mirrors the memo page: black section bars, label/value
 * rows, and each value's source, with the slides a deck value came from.
 *
 * Set in the PDF's built-in Helvetica, so there's no font to fetch. That only
 * covers Western European text; `pdfSafe` swaps the common symbols beyond it.
 */

const INK = "#14130f";
const MUTED = "#54514a";
const PAPER = "#f6f4ee";
const PAPER_2 = "#efece2";
const RULE = "#dcd9d0";

/** The badge colours of `SOURCE_BADGE`, flattened onto white. */
const TAGS: Record<FieldSource, { label: string; bg: string; fg: string; legend: string } | null> = {
  deck: { label: "deck", bg: "#dde9e2", fg: "#1a6b3f", legend: "straight from the slides" },
  web: { label: "web", bg: "#e2ecfe", fg: "#1d4ed8", legend: "found beyond the deck" },
  inferred: { label: "inference", bg: "#fdecce", fg: "#b45309", legend: "the AI's own read" },
  personal: { label: "personal", bg: "#eee7fe", fg: "#6d28d9", legend: "a person's own edit" },
  unknown: null,
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 52, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, lineHeight: 1.4, color: INK },
  title: { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.2 },
  subtitle: { marginTop: 4, fontSize: 9, color: MUTED },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 14, marginBottom: 16, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: PAPER_2 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 12, marginVertical: 1 },
  legendText: { marginLeft: 4, fontSize: 8, color: MUTED },
  section: { marginBottom: 14 },
  bar: { paddingVertical: 5, paddingHorizontal: 8, backgroundColor: INK, color: PAPER, fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.2 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE },
  label: { width: 136, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: PAPER_2, fontFamily: "Helvetica-Bold", fontSize: 8.5, color: MUTED },
  value: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },
  empty: { color: "#a9a69e" },
  name: { fontFamily: "Helvetica-Bold" },
  commitment: { marginTop: 1, fontSize: 8.5, fontFamily: "Helvetica-Oblique", color: MUTED },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 9, color: MUTED },
  bulletText: { flex: 1 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 3 },
  tag: { paddingVertical: 1, paddingHorizontal: 3, borderRadius: 2, fontFamily: "Helvetica-Bold", fontSize: 6.5, letterSpacing: 0.5 },
  slides: { marginLeft: 4, fontSize: 7.5, color: MUTED },
  // Pinned from the top of the A4 page (841.89pt tall): react-pdf places a
  // `render` text pinned with `bottom` far below the page.
  footer: { position: "absolute", top: 808, left: 40, right: 40, fontSize: 7.5, color: MUTED },
});

/**
 * Symbols outside the built-in font's character set (WinAnsi), as plain text.
 * Whatever else is outside it, it has no glyph for: emoji are dropped, and
 * other characters (non-Latin scripts) print as "?".
 */
const PLAIN: Record<string, string> = {
  "→": "->", "⟶": "->", "←": "<-", "↔": "<->", "↑": "up", "↓": "down", "⇒": "=>",
  "≈": "~", "≤": "<=", "≥": ">=", "≠": "!=", "−": "-", "‐": "-", "‑": "-", "‒": "-", "―": "-",
  "′": "'", "″": '"', "⁄": "/", "✓": "v", "✔": "v", "✗": "x", "✘": "x", "★": "*", "☆": "*",
  "▪": "•", "◦": "•", "●": "•", "○": "•", "■": "•", "□": "•", "►": ">", "▶": ">",
  "ﬁ": "fi", "ﬂ": "fl", " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", " ": " ",
};
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) {
      out += ch;
    } else if (ch in PLAIN) {
      out += PLAIN[ch];
    } else if (ch === "\t") {
      out += " ";
    } else if (!/[\p{Extended_Pictographic}\p{Mn}\p{Cf}\p{Cc}\u{fe0f}]/u.test(ch)) {
      out += "?";
    }
  }
  return out;
}

function SourceTag({ source, slides }: { source: FieldSource | undefined; slides?: number[] }) {
  const tag = source ? TAGS[source] : null;
  if (!tag) return null;
  return (
    <View style={s.meta}>
      <Text style={[s.tag, { backgroundColor: tag.bg, color: tag.fg }]}>{tag.label.toUpperCase()}</Text>
      {source === "deck" && slides?.length ? (
        <Text style={s.slides}>
          {slides.length === 1 ? "slide" : "slides"} {slides.join(", ")}
        </Text>
      ) : null}
    </View>
  );
}

function PdfRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={s.label}>{pdfSafe(label)}</Text>
      <View style={s.value}>{children}</View>
    </View>
  );
}

function TextRow({ descriptor, state }: { descriptor: FieldDescriptor; state: AnalysisState }) {
  const field = readField(state.form, descriptor.key);
  const value = field?.value.trim() ?? "";
  // A long answer may run onto the next page; a short one stays in one piece.
  const long = value.length > 600;
  return (
    <View style={s.row} wrap={long}>
      <Text style={s.label}>{pdfSafe(descriptor.label)}</Text>
      <View style={s.value}>
        {value ? <Text>{pdfSafe(value)}</Text> : <Text style={s.empty}>-</Text>}
        {value && <SourceTag source={field?.source} slides={citedSlides(state)[descriptor.key]} />}
      </View>
    </View>
  );
}

function FounderRows({ state }: { state: AnalysisState }) {
  const members = state.form.founders.members;
  const slides = citedSlides(state).founders;
  if (members.length === 0) {
    return (
      <PdfRow label="Founders">
        <Text style={s.empty}>-</Text>
      </PdfRow>
    );
  }
  return members.map((m, i) => (
    <PdfRow key={i} label={m.role || "Founder"}>
      <Text style={s.name}>{pdfSafe(m.name)}</Text>
      {m.commitment ? <Text style={s.commitment}>{pdfSafe(m.commitment)}</Text> : null}
      {m.background.map((b, j) => (
        <View key={j} style={s.bullet}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{pdfSafe(b)}</Text>
        </View>
      ))}
      <SourceTag source={founderSource(m, slides)} slides={slides} />
    </PdfRow>
  ));
}

/** The analysis date, from when the run started. */
function analysedOn(state: AnalysisState): string | null {
  if (!state.startedAt) return null;
  return new Date(state.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function MemoPdf({ state }: { state: AnalysisState }) {
  const company = state.form.company.name.value.trim() || "Untitled deck";
  const date = analysedOn(state);
  const legend = (Object.values(TAGS) as (typeof TAGS)[FieldSource][]).filter((t) => t !== null);

  return (
    <Document title={pdfSafe(`${company}: due-diligence memo`)} author="SevenFold" creator="SevenFold" producer="SevenFold">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{pdfSafe(company)}</Text>
        <Text style={s.subtitle}>Due-diligence memo{date ? ` · analysed ${date}` : ""}</Text>

        <View style={s.legend}>
          {legend.map((t) => (
            <View key={t.label} style={s.legendItem}>
              <Text style={[s.tag, { backgroundColor: t.bg, color: t.fg }]}>{t.label.toUpperCase()}</Text>
              <Text style={s.legendText}>{t.legend}</Text>
            </View>
          ))}
        </View>

        {DOC_SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            {/* Keep a bar with at least its first row, never alone at a page's foot. */}
            <Text style={s.bar} wrap={false} minPresenceAhead={36}>
              {pdfSafe(section.title.toUpperCase())}
            </Text>
            {section.fields.map((f) =>
              f.kind === "founders" ? (
                <FounderRows key={f.key} state={state} />
              ) : f.kind === "text" ? (
                <TextRow key={f.key} descriptor={f} state={state} />
              ) : null,
            )}
          </View>
        ))}

        <Text style={s.footer} fixed>
          SevenFold · {pdfSafe(company)}
        </Text>
        <Text
          style={[s.footer, { textAlign: "right" }]}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
