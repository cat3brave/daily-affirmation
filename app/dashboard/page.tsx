import { redirect } from "next/navigation";
import { isGeminiAffirmationEnabled } from "../lib/affirmationMode";
import { getAuthenticatedUser } from "../lib/supabaseServer";
import { isGeminiTranslationEnabled } from "../lib/translationMode";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return (
    <DashboardClient
      user={{ id: user.id, email: user.email }}
      affirmationEnabled={isGeminiAffirmationEnabled()}
      translationEnabled={isGeminiTranslationEnabled()}
    />
  );
}
