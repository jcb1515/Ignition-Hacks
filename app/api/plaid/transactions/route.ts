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

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    const endDate = new Date();

    const response = await plaid.transactionsGet({
      access_token,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      options: { count: 100, offset: 0 },
    });

    return NextResponse.json({ transactions: response.data.transactions });
  } catch (error) {
    console.error("Plaid transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Plaid transactions" },
      { status: 500 }
    );
  }
}
