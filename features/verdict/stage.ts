import { predictInvest } from "@/lib/invest/model";
import type { PipelineStage } from "@/lib/diligence/types";

/**
 * The invest/don't-invest verdict from the custom ONNX model, read off the
 * scorecard. Waits for the landscape too (when it's still going) so the
 * report goes out with it.
 */
export const verdictStage: PipelineStage = {
  id: "verdict",
  needs: ["feedback", "landscape"],
  waitingStatus: { phase: "completing", message: "Finishing the competitive landscape" },
  status: { phase: "verdict", message: "Running the investment model" },
  async run({ form, emit }) {
    const verdict = await predictInvest(form.scorecard);
    form.verdict = verdict;
    emit({ type: "verdict", verdict });
  },
};
