import Stripe from "stripe";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) {
    return null;
  }
  return new Stripe(key, {
    appInfo: {
      name: "Runway Radar",
    },
  });
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true" || !getStripe();
}
