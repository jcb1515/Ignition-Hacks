import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import type { Vendor } from "@/lib/types";

export default function VendorTable({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-card text-left">
            <th className="pb-3 font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Vendor
            </th>
            <th className="pb-3 font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Category
            </th>
            <th className="pb-3 text-right font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Monthly
            </th>
            <th className="pb-3 text-center font-mono text-xs font-medium uppercase tracking-tight text-muted">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-card">
          {vendors.map((vendor) => (
            <tr key={vendor.id}>
              <td className="py-3 font-medium text-on-card">{vendor.name}</td>
              <td className="py-3 text-muted">{vendor.category}</td>
              <td className="py-3 text-right text-on-card">
                {formatCurrency(vendor.monthlyCost)}
              </td>
              <td className="py-3 text-center">
                {vendor.status === "flagged" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red/10 px-2.5 py-1 text-xs font-medium text-red">
                    <AlertTriangle size={12} /> Flagged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-mint/10 px-2.5 py-1 text-xs font-medium text-mint">
                    <CheckCircle2 size={12} /> Safe
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
