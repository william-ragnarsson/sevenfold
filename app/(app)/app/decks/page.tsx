import PageHead, { PAGE } from "@/components/app-shell/PageHead";
import AnalysisWorkspace from "@/components/features/analyze/AnalysisWorkspace";

export default function DecksPage() {
  return (
    <div className={PAGE}>
      <div className="max-w-3xl">
        <PageHead title="Analyse pitch deck" />
        <AnalysisWorkspace />
      </div>
    </div>
  );
}
