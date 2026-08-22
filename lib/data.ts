export interface Vendor {
  id: string;
  name: string;
  category: string;
  monthlyCost: number;
  contractTerms: string;
  lastContactDate: string;
  contactEmail: string;
  status: "safe" | "flagged" | "negotiating" | "cancelled";
}

export interface Transaction {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  date: string;
  source: "Plaid" | "Stripe";
  flagged: boolean;
  reason?: string;
  confidence?: number;
}

export interface AgentAction {
  id: string;
  timestamp: string;
  agent: "Classifier" | "Negotiator" | "Forecast" | "Orchestrator";
  type: string;
  target?: string;
  reasoning: string;
  humanApproved: boolean;
  dollarImpact: number;
}

export interface ForecastPoint {
  month: string;
  current: number;
  aggressiveCut: number;
  hiringFreeze: number;
}

export interface BurnPoint {
  month: string;
  burn: number;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export const vendors: Vendor[] = [
  {
    id: "v1",
    name: "Twilio",
    category: "Communication",
    monthlyCost: 6400,
    contractTerms: "Annual, paid monthly",
    lastContactDate: "2025-11-12",
    contactEmail: "billing@twilio.com",
    status: "flagged",
  },
  {
    id: "v2",
    name: "Notion",
    category: "Productivity",
    monthlyCost: 480,
    contractTerms: "Monthly",
    lastContactDate: "2026-01-05",
    contactEmail: "support@notion.so",
    status: "safe",
  },
  {
    id: "v3",
    name: "Confluence",
    category: "Productivity",
    monthlyCost: 420,
    contractTerms: "Monthly",
    lastContactDate: "2025-09-20",
    contactEmail: "support@atlassian.com",
    status: "flagged",
  },
  {
    id: "v4",
    name: "Vercel",
    category: "Infrastructure",
    monthlyCost: 2400,
    contractTerms: "Pro plan, monthly",
    lastContactDate: "2026-01-18",
    contactEmail: "support@vercel.com",
    status: "safe",
  },
  {
    id: "v5",
    name: "Figma",
    category: "Design",
    monthlyCost: 1080,
    contractTerms: "Annual",
    lastContactDate: "2025-12-01",
    contactEmail: "billing@figma.com",
    status: "safe",
  },
  {
    id: "v6",
    name: "Segment",
    category: "Analytics",
    monthlyCost: 3200,
    contractTerms: "Monthly",
    lastContactDate: "2025-10-10",
    contactEmail: "billing@segment.com",
    status: "flagged",
  },
  {
    id: "v7",
    name: "Linear",
    category: "Productivity",
    monthlyCost: 192,
    contractTerms: "Monthly",
    lastContactDate: "2026-01-12",
    contactEmail: "support@linear.app",
    status: "safe",
  },
  {
    id: "v8",
    name: "Slack",
    category: "Communication",
    monthlyCost: 2400,
    contractTerms: "Annual",
    lastContactDate: "2025-08-15",
    contactEmail: "billing@slack.com",
    status: "safe",
  },
];

export const transactions: Transaction[] = [
  {
    id: "t1",
    vendorId: "v1",
    vendorName: "Twilio",
    amount: 6400,
    date: "2026-01-01",
    source: "Plaid",
    flagged: true,
    reason: "2.3x the communication category average",
    confidence: 0.94,
  },
  {
    id: "t2",
    vendorId: "v2",
    vendorName: "Notion",
    amount: 480,
    date: "2026-01-01",
    source: "Plaid",
    flagged: false,
  },
  {
    id: "t3",
    vendorId: "v3",
    vendorName: "Confluence",
    amount: 420,
    date: "2026-01-01",
    source: "Plaid",
    flagged: true,
    reason: "Duplicate knowledge-base subscription with Notion",
    confidence: 0.89,
  },
  {
    id: "t4",
    vendorId: "v8",
    vendorName: "Slack",
    amount: 2400,
    date: "2026-01-01",
    source: "Plaid",
    flagged: false,
  },
  {
    id: "t5",
    vendorId: "v6",
    vendorName: "Segment",
    amount: 3200,
    date: "2026-01-01",
    source: "Stripe",
    flagged: true,
    reason: "Usage flatlined while cost stayed flat; renegotiate tier",
    confidence: 0.81,
  },
  {
    id: "t6",
    vendorId: "v4",
    vendorName: "Vercel",
    amount: 2400,
    date: "2026-01-01",
    source: "Plaid",
    flagged: false,
  },
  {
    id: "t7",
    vendorId: "v5",
    vendorName: "Figma",
    amount: 1080,
    date: "2026-01-01",
    source: "Plaid",
    flagged: false,
  },
  {
    id: "t8",
    vendorId: "v7",
    vendorName: "Linear",
    amount: 192,
    date: "2026-01-01",
    source: "Stripe",
    flagged: false,
  },
  {
    id: "t9",
    vendorId: "v1",
    vendorName: "Twilio",
    amount: 6400,
    date: "2025-12-01",
    source: "Plaid",
    flagged: true,
    reason: "2.3x the communication category average",
    confidence: 0.94,
  },
  {
    id: "t10",
    vendorId: "v3",
    vendorName: "Confluence",
    amount: 420,
    date: "2025-12-01",
    source: "Plaid",
    flagged: true,
    reason: "Duplicate knowledge-base subscription with Notion",
    confidence: 0.89,
  },
];

export const actions: AgentAction[] = [
  {
    id: "a1",
    timestamp: "2026-01-21 09:14:02",
    agent: "Classifier",
    type: "flag_anomaly",
    target: "Twilio",
    reasoning:
      "Twilio monthly cost of $6,400 is 2.3x the communication category average for startups ($2,700). No corresponding usage spike observed.",
    humanApproved: true,
    dollarImpact: -6400,
  },
  {
    id: "a2",
    timestamp: "2026-01-21 09:14:04",
    agent: "Classifier",
    type: "flag_duplicate",
    target: "Confluence",
    reasoning:
      "Confluence and Notion both serve as team knowledge bases. 89% feature overlap and 12 active users on both tools.",
    humanApproved: true,
    dollarImpact: -420,
  },
  {
    id: "a3",
    timestamp: "2026-01-21 09:14:07",
    agent: "Negotiator",
    type: "draft_email",
    target: "Twilio",
    reasoning:
      "Drafted a rate renegotiation email citing burn-rate benchmarking and requesting a tier review.",
    humanApproved: false,
    dollarImpact: 0,
  },
  {
    id: "a4",
    timestamp: "2026-01-21 09:14:12",
    agent: "Forecast",
    type: "runway_projection",
    reasoning:
      "Burn rate is $38.4k/mo at current spend. Aggressive vendor cuts extend runway from 8 to 14 months.",
    humanApproved: true,
    dollarImpact: 0,
  },
];

export const burnData: BurnPoint[] = [
  { month: "Feb", burn: 28000 },
  { month: "Mar", burn: 29500 },
  { month: "Apr", burn: 31000 },
  { month: "May", burn: 34000 },
  { month: "Jun", burn: 36500 },
  { month: "Jul", burn: 35800 },
  { month: "Aug", burn: 37200 },
  { month: "Sep", burn: 38400 },
  { month: "Oct", burn: 39000 },
  { month: "Nov", burn: 41000 },
  { month: "Dec", burn: 40500 },
  { month: "Jan", burn: 38400 },
];

export const runwayData: ForecastPoint[] = (() => {
  const months = [
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
  ];
  const start = 300000;
  const currentBurn = 38400;
  const cutBurn = 22000;
  const freezeBurn = 30000;
  return months.map((month, i) => {
    const m = i + 1;
    return {
      month,
      current: Math.max(0, start - currentBurn * m),
      aggressiveCut: Math.max(0, start - cutBurn * m),
      hiringFreeze: Math.max(0, start - freezeBurn * m),
    };
  });
})();
