import { getStripe, isDemoMode } from "@/lib/stripe";
import {
  vendors as demoVendors,
  transactions as demoTransactions,
} from "@/lib/data";
import type { Vendor, Transaction } from "@/lib/data";

export interface BillingSummary {
  demo: boolean;
  monthlyBurn: number;
  transactions: Transaction[];
  vendors: Vendor[];
}

export async function getBillingSummary(): Promise<BillingSummary> {
  if (isDemoMode()) {
    return {
      demo: true,
      monthlyBurn: 38400,
      transactions: demoTransactions,
      vendors: demoVendors,
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      demo: true,
      monthlyBurn: 38400,
      transactions: demoTransactions,
      vendors: demoVendors,
    };
  }

  try {
    const { data: subscriptions } = await stripe.subscriptions.list({
      limit: 100,
      status: "all",
      expand: ["data.customer", "data.items.data.price"],
    });

    const vendorMap = new Map<string, Vendor>();
    let monthlyBurn = 0;

    for (const sub of subscriptions) {
      for (const item of sub.items.data) {
        const price = item.price as any;
        const amount = (price?.unit_amount || 0) * (item.quantity || 1);
        const interval = price?.recurring?.interval || "month";
        const monthlyAmount = toMonthly(amount, interval);
        monthlyBurn += monthlyAmount;

        let product: any = null;
        if (price?.product && stripe) {
          if (typeof price.product === "string") {
            try {
              product = await stripe.products.retrieve(price.product);
            } catch {
              product = null;
            }
          } else if (typeof price.product === "object") {
            product = price.product;
          }
        }

        const name = product?.name || price?.nickname || "Unknown vendor";
        const category = product?.metadata?.category || guessCategory(name);
        const email =
          product?.metadata?.billing_email ||
          `billing@${name.toLowerCase().replace(/\s+/g, "")}.com`;

        const vendor: Vendor = {
          id: item.id,
          name,
          category,
          monthlyCost: monthlyAmount,
          contractTerms: `${interval}ly`,
          lastContactDate: new Date(sub.created * 1000)
            .toISOString()
            .split("T")[0],
          contactEmail: email,
          status: shouldFlag(name, monthlyAmount),
        };

        vendorMap.set(name, vendor);
      }
    }

    const vendors = Array.from(vendorMap.values()).sort(
      (a, b) => b.monthlyCost - a.monthlyCost
    );

    const { data: charges } = await stripe.charges.list({
      limit: 100,
      expand: ["data.customer"],
    });

    const transactions: Transaction[] = charges.map((charge) => {
      const vendorName =
        (charge.description || "Stripe payment").replace(/^(.*?) - /, "$1");
      const amount = charge.amount / 100;
      const isFlagged =
        amount > 3000 ||
        vendors.some((v) => v.name === vendorName && v.status === "flagged");
      return {
        id: charge.id,
        vendorId:
          typeof charge.customer === "string"
            ? charge.customer
            : charge.customer?.id || charge.id,
        vendorName,
        amount,
        date: new Date(charge.created * 1000).toISOString().split("T")[0],
        source: "Stripe",
        flagged: isFlagged,
        reason: isFlagged ? "Amount above category average" : undefined,
        confidence: isFlagged ? 0.9 : undefined,
      };
    });

    return {
      demo: false,
      monthlyBurn,
      transactions: transactions.slice(0, 12),
      vendors,
    };
  } catch (error) {
    console.error("Stripe billing fetch failed:", error);
    return {
      demo: true,
      monthlyBurn: 38400,
      transactions: demoTransactions,
      vendors: demoVendors,
    };
  }
}

function toMonthly(cents: number, interval: string): number {
  const dollars = cents / 100;
  switch (interval) {
    case "year":
      return dollars / 12;
    case "month":
      return dollars;
    case "week":
      return dollars * 4.333;
    case "day":
      return dollars * 30;
    default:
      return dollars;
  }
}

function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("twilio") || lower.includes("slack"))
    return "Communication";
  if (lower.includes("vercel") || lower.includes("aws")) return "Infrastructure";
  if (lower.includes("segment") || lower.includes("analytics"))
    return "Analytics";
  if (lower.includes("figma")) return "Design";
  if (
    lower.includes("notion") ||
    lower.includes("confluence") ||
    lower.includes("linear")
  )
    return "Productivity";
  return "Software";
}

function shouldFlag(name: string, monthlyAmount: number): Vendor["status"] {
  const known = ["twilio", "segment", "confluence"];
  if (known.some((k) => name.toLowerCase().includes(k))) return "flagged";
  if (monthlyAmount > 3000) return "flagged";
  return "safe";
}
