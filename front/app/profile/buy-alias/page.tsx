"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { useSolana, usePhantom, useModal, useAccounts } from "@phantom/react-sdk";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";

const CLAIM_PRICE_SOL = 0.00001;
const CLAIM_PRICE_LAMPORTS = Math.round(CLAIM_PRICE_SOL * LAMPORTS_PER_SOL);
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "";

type Step = "idle" | "building" | "signing" | "registering" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  building: "Preparing transaction…",
  signing: "Waiting for wallet approval…",
  registering: "Registering your alias…",
  done: "Done!",
  error: "",
};

export default function BuyAliasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const alias = searchParams.get("alias") ?? "";

  const { isConnected } = usePhantom();
  const { open: openModal } = useModal();
  const accounts = useAccounts();
  const { solana } = useSolana();

  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const walletAddress = accounts?.[0]?.address ?? null;

  const handleClaim = useCallback(async () => {
    if (!isConnected || !walletAddress || !solana) {
      openModal();
      return;
    }

    setStep("building");
    setErrorMsg("");

    try {
      const connection = new Connection(RPC_URL, "confirmed");
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const senderPubkey = new PublicKey(walletAddress);
      const treasuryPubkey = new PublicKey(TREASURY);

      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = senderPubkey;

      tx.add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: treasuryPubkey,
          lamports: CLAIM_PRICE_LAMPORTS,
        })
      );

      setStep("signing");
      const { signature } = await solana.signAndSendTransaction(tx);

      setStep("registering");
      const res = await fetch(
        `/api/actions/claim-alias/confirm?alias=${encodeURIComponent(alias)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: walletAddress, signature }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Registration failed (${res.status})`);
      }

      setStep("done");
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (err: unknown) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }, [isConnected, walletAddress, solana, alias, openModal, router]);

  const busy = step === "building" || step === "signing" || step === "registering";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-[#3b0149] to-black text-white px-4">
      <div className="bg-[#18181b] rounded-2xl shadow-xl p-8 max-w-md w-full flex flex-col items-center gap-6">

        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-4xl">⚡</span>
          <h1 className="text-3xl font-bold">Claim your alias</h1>
          <p className="text-zinc-400 text-sm text-center">
            Reserve{" "}
            <span className="font-semibold text-[#00F5A0]">@{alias || "—"}</span>{" "}
            for your creator card on VYNX.
          </p>
        </div>

        {/* Price card */}
        <div className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Registration fee</span>
          <span className="font-bold text-white">{CLAIM_PRICE_SOL} SOL</span>
        </div>

        {/* Wallet status */}
        {isConnected && walletAddress ? (
          <p className="text-xs text-zinc-500 font-mono truncate w-full text-center">
            {walletAddress}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 text-center">
            Connect your wallet to proceed.
          </p>
        )}

        {/* Step feedback */}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="animate-spin">⏳</span>
            {STEP_LABELS[step]}
          </div>
        )}

        {step === "done" && (
          <div className="flex items-center gap-2 text-[#00F5A0] font-semibold">
            ✅ @{alias} claimed! Redirecting…
          </div>
        )}

        {step === "error" && (
          <p className="text-red-400 text-sm text-center">{errorMsg}</p>
        )}

        {/* CTA */}
        <Button
          className="w-full bg-[#00F5A0] hover:bg-[#6B4EFF] text-black font-bold rounded-md py-4 text-base shadow-xl transition disabled:opacity-50"
          disabled={busy || step === "done" || !alias}
          onClick={handleClaim}
        >
          {!isConnected
            ? "Connect Wallet"
            : busy
            ? STEP_LABELS[step]
            : step === "done"
            ? "Done!"
            : `Claim @${alias} — ${CLAIM_PRICE_SOL} SOL`}
        </Button>

        <p className="text-xs text-zinc-600 text-center">
          Payment goes directly on-chain. Alias registration is recorded in VYNX.
        </p>
      </div>
    </div>
  );
}
