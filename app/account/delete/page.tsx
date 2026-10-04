import { cookies } from "next/headers";
import { getAuthenticatedUser } from "../../lib/supabaseServer";
import { DELETION_COOKIE, deletionConfiguration } from "../../lib/accountDeletionServer";
import DeleteAccountForm from "./DeleteAccountForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "アカウント削除 | Daily Affirmation" };
export default async function DeleteAccountPage() {
  const user = await getAuthenticatedUser();
  const hasReceipt = Boolean((await cookies()).get(DELETION_COOKIE)?.value);
  return <DeleteAccountForm enabled={Boolean(deletionConfiguration())} signedIn={Boolean(user)} hasReceipt={hasReceipt} />;
}
