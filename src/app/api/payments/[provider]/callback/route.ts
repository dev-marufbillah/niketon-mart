import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * No provider-specific gateway is implemented. Reject without parsing an
 * untrusted body or mutating an order. Credentials must not enable this route.
 * A future integration must implement and test the provider's actual protocol.
 */
function unavailable() {
  return NextResponse.json({ ok: false, error: "Online payments are not integrated." }, { status: 503 });
}

export async function GET() { return unavailable(); }
export async function POST() { return unavailable(); }
