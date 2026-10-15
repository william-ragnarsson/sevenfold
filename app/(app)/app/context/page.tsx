import type { Metadata } from "next";
import PageHead, { PAGE } from "@/components/app-shell/PageHead";
import PlaybookBody from "@/components/features/playbook/PlaybookBody";

export const metadata: Metadata = { title: "Context · SevenFold" };

export default function ContextPage() {
  return (
    <div className={PAGE}>
      <div className="max-w-3xl">
        <PageHead
          title="Context"
          sub="The criteria every deck is scored against, drawn from a year of weekly deal reviews."
        />
        <PlaybookBody />
      </div>
    </div>
  );
}
