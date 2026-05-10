import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";

const CLAIM_PRICE_SOL = 0.00001;
const CLAIM_PRICE_LAMPORTS = Math.round(CLAIM_PRICE_SOL * LAMPORTS_PER_SOL);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept-Encoding",
  "X-Action-Version": "2.1.3",
  "X-Blockchain-Ids": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// GET — Blink metadata
export async function GET(request: NextRequest) {
  const alias = request.nextUrl.searchParams.get("alias") ?? "alias";
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  return NextResponse.json(
    {
      title: `Claim @${alias} on VYNX`,
      icon: `${origin}/logo.png`,
      description: `Pay ${CLAIM_PRICE_SOL} SOL to register @${alias} as your creator card alias on VYNX.`,
      label: `Claim @${alias} — ${CLAIM_PRICE_SOL} SOL`,
      links: {
        actions: [
          {
            label: `Claim for ${CLAIM_PRICE_SOL} SOL`,
            href: `/api/actions/claim-alias?alias=${encodeURIComponent(alias)}`,
          },
        ],
      },
    },
    { headers: CORS }
  );
}

// POST — Build & return the unsigned transaction (Solana Actions spec)
export async function POST(request: NextRequest) {
  const alias = request.nextUrl.searchParams.get("alias") ?? "";

  if (!alias) {
    return NextResponse.json(
      { error: "alias query param is required" },
      { status: 400, headers: CORS }
    );
  }

  const body = await request.json().catch(() => ({}));
  const account: string = body.account ?? "";

  if (!account) {
    return NextResponse.json(
      { error: "account is required in request body" },
      { status: 400, headers: CORS }
    );
  }

  const treasury = process.env.NEXT_PUBLIC_TREASURY_WALLET;
  if (!treasury || treasury.startsWith("REPLACE_")) {
    return NextResponse.json(
      { error: "Treasury wallet not configured" },
      { status: 503, headers: CORS }
    );
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const senderPubkey = new PublicKey(account);
  const treasuryPubkey = new PublicKey(treasury);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = senderPubkey;

  tx.add(
    SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: treasuryPubkey,
      lamports: CLAIM_PRICE_LAMPORTS,
    })
  );

  const serialized = tx.serialize({ requireAllSignatures: false });

  return NextResponse.json(
    {
      transaction: Buffer.from(serialized).toString("base64"),
      message: `Claiming @${alias} for ${CLAIM_PRICE_SOL} SOL`,
      links: {
        next: {
          type: "post",
          href: `/api/actions/claim-alias/confirm?alias=${encodeURIComponent(alias)}`,
        },
      },
    },
    { headers: CORS }
  );
}
