import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "./lib/supabaseServer";

export default async function LandingPage() {
  const user = await getAuthenticatedUser();
  redirect(user ? "/dashboard" : "/login");
}
