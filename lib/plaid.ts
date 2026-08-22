import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function getPlaid(): PlaidApi | null {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase() as
    | "sandbox"
    | "development"
    | "production";

  if (!clientId || !secret || clientId === "your_plaid_client_id") {
    return null;
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

export function isPlaidConfigured(): boolean {
  return !!getPlaid();
}
