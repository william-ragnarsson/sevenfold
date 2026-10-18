import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** The dashboard opens on due diligence, the one thing most visits are for. */
export default function DashboardPage() {
  redirect(ROUTES.dueDiligence);
}
