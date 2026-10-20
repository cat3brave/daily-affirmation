import Link from "next/link";
import PasswordRecoveryLayout, { recoveryLinkClass } from "../../components/PasswordRecoveryLayout";

export default function InvalidRecoveryPage() {
  return <PasswordRecoveryLayout title="復旧リンクを確認できませんでした">
    <p role="alert" className="text-sm leading-relaxed text-red-700">リンクが無効、期限切れ、使用済み、または依頼時のブラウザー情報を確認できません。依頼したブラウザーで開くか、復旧メールをもう一度依頼してください。</p>
    <p className="mt-5 text-center"><Link href="/forgot-password" className={recoveryLinkClass}>復旧メールを再依頼する</Link></p>
  </PasswordRecoveryLayout>;
}
