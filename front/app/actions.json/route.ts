import { NextResponse } from "next/server";
import { TIP_ACTION_HEADERS } from "@/lib/tip-action";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: TIP_ACTION_HEADERS });
}

// Serves GET /actions.json — required by the Solana Actions / Blinks spec
// so external clients can discover this app's actions.
export async function GET() {
  return NextResponse.json(
    {
      rules: [
        {
          pathPattern: "/profile/buy-alias",
          apiPath: "/api/actions/claim-alias",
        },
        {
          pathPattern: "/api/actions/**",
          apiPath: "/api/actions/**",
        },
        { pathPattern: "/creators/*", apiPath: "/api/actions/tip/*" },
        { pathPattern: "/*", apiPath: "/api/actions/tip/*" },
      ],
    },
    {
      headers: TIP_ACTION_HEADERS,
    }
  );
}
