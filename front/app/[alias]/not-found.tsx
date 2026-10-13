
import { useCopy } from "@/i18n/copy";
import { WalletAuthGate } from '@/components/WalletAuthGate';

export default function CreatorNotFound() {
  const t = useCopy();
  return <WalletAuthGate
    reloadAfterSignIn
    title={t("Card unavailable")}
    description={t("This card is unpublished or does not exist. If you own this alias, connect its wallet and approve the sign-in message to view and edit your card.")}
  />;
}
