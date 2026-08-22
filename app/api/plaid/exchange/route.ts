import { NextRequest, NextResponse } from "next/server";
import { getPlaid } from "@/lib/plaid";

export async function POST(req: NextRequest) {
  const plaid = getPlaid();
  if (!plaid) {
    return NextResponse.json(
      { error: "Plaid is not configured" },
      { status: 500 }
    );
  }

  try {
    const { public_token } = (await req.json()) as { public_token?: string };
    if (!public_token) {
      return NextResponse.json(
        { error: "Missing public_token" },
        { status: 400 }
      );
    }

    const response = await plaid.itemPublicTokenExchange({
      public_token,
    });

    return NextResponse.json({
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    });
  } catch (error) {
    console.error("Plaid exchange error:", error);
    return NextResponse.json(
      { error: "Failed to exchange Plaid token" },
      { status: 500 }
    );
  }
}
