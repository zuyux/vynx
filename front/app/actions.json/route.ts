import { NextResponse } from "next/server";

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
      ],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
