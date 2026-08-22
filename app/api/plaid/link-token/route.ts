import { NextRequest, NextResponse } from "next/server";
import { getPlaid } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export async function POST(req: NextRequest) {
  const plaid = getPlaid();
  if (!plaid) {
    return NextResponse.json(
      { error: "Plaid is not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: "runway-radar-user" },
      client_name: "Runway Radar",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Plaid link token error:", error);
    return NextResponse.json(
      { error: "Failed to create Plaid link token" },
      { status: 500 }
    );
  }
}
