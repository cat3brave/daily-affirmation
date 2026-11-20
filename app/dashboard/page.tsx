import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../lib/supabaseServer";
import { isGeminiTranslationEnabled } from "../lib/translationMode";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return (
    <DashboardClient
      user={{ id: user.id, email: user.email }}
      translationEnabled={isGeminiTranslationEnabled()}
    />
  );
}
