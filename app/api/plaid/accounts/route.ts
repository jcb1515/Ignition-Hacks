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
    const { access_token } = (await req.json()) as { access_token?: string };
    if (!access_token) {
      return NextResponse.json(
        { error: "Missing access_token" },
        { status: 400 }
      );
    }

    const response = await plaid.accountsBalanceGet({
      access_token,
    });

    return NextResponse.json({
      accounts: response.data.accounts,
      item: response.data.item,
    });
  } catch (error) {
    console.error("Plaid accounts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Plaid accounts" },
      { status: 500 }
    );
  }
}
