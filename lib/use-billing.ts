"use client";

import { useEffect, useState } from "react";
import { vendors as demoVendors, transactions as demoTransactions } from "@/lib/data";
import type { Vendor, Transaction } from "@/lib/data";

interface BillingSummary {
  demo: boolean;
  monthlyBurn: number;
  transactions: Transaction[];
  vendors: Vendor[];
}

export function useBilling() {
  const [data, setData] = useState<BillingSummary>({
    demo: true,
    monthlyBurn: 38400,
    transactions: demoTransactions,
    vendors: demoVendors,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/stripe/billing")
      .then((res) => res.json())
      .then((summary: BillingSummary) => {
        if (!cancelled) {
          setData(summary);
        }
      })
      .catch((err) => {
        console.error("Billing fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading };
}
