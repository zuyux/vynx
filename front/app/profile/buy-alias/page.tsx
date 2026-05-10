"use client";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function BuyAliasPage() {
  const searchParams = useSearchParams();
  const alias = searchParams.get("alias") || "";
  const [isBuying, setIsBuying] = useState(false);
  // TODO: Integrate Solana payment logic here

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#3b0149] to-[#000] text-white">
      <div className="bg-[#18181b] rounded-2xl shadow-xl p-8 max-w-md w-full flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-4">Claim your alias</h1>
        <p className="mb-6 text-lg text-zinc-300">Reserve <span className="font-semibold text-[#00F5A0]">@{alias}</span> for your creator card. Complete the payment to own this alias on Solana.</p>
        <Button
          className="bg-[#00F5A0] hover:bg-[#6B4EFF] text-black font-bold rounded-md px-8 py-4 text-lg shadow-xl transition"
          disabled={isBuying}
          onClick={() => {
            setIsBuying(true);
            // TODO: Trigger Solana transaction for alias purchase
            setTimeout(() => setIsBuying(false), 2000);
          }}
        >
          {isBuying ? "Processing..." : `Buy @${alias} with Solana`}
        </Button>
      </div>
    </div>
  );
}