import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Called by blink clients (and internally) after the tx is signed and confirmed
export async function POST(request: NextRequest) {
  const alias = request.nextUrl.searchParams.get("alias") ?? "";

  const body = await request.json().catch(() => ({}));
  const walletAddress: string = body.account ?? "";
  const txSignature: string = body.signature ?? "";

  if (!alias || !walletAddress) {
    return NextResponse.json(
      { error: "alias and account are required" },
      { status: 400, headers: CORS }
    );
  }

  // Check alias is still available
  const { data: existing } = await supabaseAdmin
    .from("cards_users")
    .select("id")
    .eq("username", alias.toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Alias already taken" },
      { status: 409, headers: CORS }
    );
  }

  const { error } = await supabaseAdmin.from("cards_users").insert({
    wallet_address: walletAddress,
    username: alias.toLowerCase(),
    tx_signature: txSignature || null,
  });

  if (error) {
    console.error("[register]", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS }
    );
  }

  // Solana Actions nextAction response format
  return NextResponse.json(
    {
      type: "completed",
      title: `@${alias} is yours!`,
      icon: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/logo.png`,
      description: "Your creator card is live on VYNX.",
      label: "Done",
    },
    { headers: CORS }
  );
}
