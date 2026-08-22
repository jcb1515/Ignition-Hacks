import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/data";
import type { Vendor } from "@/lib/data";

export default function VendorTable({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-card text-left">
            <th className="pb-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              Vendor
            </th>
            <th className="pb-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              Category
            </th>
            <th className="pb-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              Monthly
            </th>
            <th className="pb-3 text-center font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-card">
          {vendors.map((vendor) => (
            <tr key={vendor.id} className="data-row hover:bg-card-2">
              <td className="py-3 font-medium text-on-card">{vendor.name}</td>
              <td className="py-3 text-muted">{vendor.category}</td>
              <td className="py-3 text-right font-mono text-on-card">
                {formatCurrency(vendor.monthlyCost)}
              </td>
              <td className="py-3 text-center">
                {vendor.status === "flagged" ? (
                  <span className="inline-flex items-center gap-1 bg-red/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-red">
                    <AlertTriangle size={12} /> Flagged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-azure/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-azure">
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
