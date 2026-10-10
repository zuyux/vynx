import { WalletAuthGate } from '@/components/WalletAuthGate';

export default function CreatorNotFound() {
  return <WalletAuthGate
    reloadAfterSignIn
    title="Card unavailable"
    description="This card is unpublished or does not exist. If you own this alias, connect its wallet and approve the sign-in message to view and edit your card."
  />;
}
