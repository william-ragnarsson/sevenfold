import fs from "fs";
import path from "path";

// `n` is the section number, set on h2s only. It's counted here rather than
// while rendering, where mutating a counter breaks React's purity rules.
type Block = { type: "h2" | "h3" | "p" | "li" | "quote"; text: string; n?: number };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  let sectionNo = 0;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line || line === "---" || line.startsWith("# ")) continue;
    if (line.startsWith("> ")) blocks.push({ type: "quote", text: line.slice(2) });
    else if (line.startsWith("### ")) blocks.push({ type: "h3", text: line.slice(4) });
    else if (line.startsWith("## "))
      blocks.push({ type: "h2", text: line.slice(3).replace(/^\d+\.\s*/, ""), n: ++sectionNo });
    else if (line.startsWith("- ")) blocks.push({ type: "li", text: line.slice(2) });
    else blocks.push({ type: "p", text: line });
  }
  return blocks;
}

// inline **bold** + *italic*
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**")) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*")) return <em key={i} className="italic text-ink">{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

/**
 * The criteria the analysis scores decks against, rendered from
 * docs/playbook.md. The public /playbook and the dashboard's Context page
 * both show it, each under its own heading.
 */
export default function PlaybookBody() {
  const md = fs.readFileSync(path.join(process.cwd(), "docs/playbook.md"), "utf8");
  const blocks = parse(md);

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.type === "quote")
          return (
            <p key={i} className="rounded-3xl border border-ink/10 bg-white/50 backdrop-blur p-6 text-muted leading-relaxed italic">
              {b.text}
            </p>
          );
        if (b.type === "h2")
          return (
            <h2 key={i} className="flex items-center gap-3 pt-10 text-2xl font-bold tracking-tight text-ink">
              <span className="grid place-items-center w-8 h-8 rounded-xl bg-ink text-paper text-sm font-bold shrink-0">{b.n}</span>
              {b.text}
            </h2>
          );
        if (b.type === "h3")
          return <h3 key={i} className="pt-5 text-base font-semibold text-accent">{inline(b.text)}</h3>;
        if (b.type === "li")
          return (
            <div key={i} className="flex gap-3 pl-1">
              <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <p className="text-muted leading-relaxed">{inline(b.text)}</p>
            </div>
          );
        return <p key={i} className="text-muted leading-relaxed">{inline(b.text)}</p>;
      })}
    </div>
  );
}
