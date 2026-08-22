/**
 * Sandbox-only mail delivery.
 *
 * The build plan is emphatic that nothing should ever reach a real vendor, and
 * that at hour twenty under pressure somebody will be tempted to flip it on.
 * So the guard is in code, not in discipline: `deliver` refuses to talk to any
 * SMTP host that is not a known sandbox. Pointing SMTP_HOST at a real provider
 * does not "enable production sending", it throws.
 */
import nodemailer from "nodemailer";
import type { Draft } from "@/lib/db/queries";

/** Hosts that cannot deliver to the outside world. */
const SANDBOX_HOSTS = [
  "sandbox.smtp.mailtrap.io",
  "smtp.mailtrap.io",
  "localhost",
  "127.0.0.1",
  "mailhog",
  "maildev",
];

export interface DeliveryResult {
  sent: boolean;
  detail: string;
}

function isSandbox(host: string): boolean {
  return SANDBOX_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export async function deliver(draft: Draft): Promise<DeliveryResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return {
      sent: false,
      detail:
        "No sandbox inbox configured, so the message was recorded as approved but not transmitted. Set SMTP_HOST/USER/PASS to a Mailtrap sandbox to see it land in an inbox.",
    };
  }

  if (!isSandbox(host)) {
    throw new Error(
      `Refusing to send: SMTP_HOST "${host}" is not a recognised sandbox. ` +
      `This build has no production mail path by design. Allowed: ${SANDBOX_HOSTS.join(", ")}.`
    );
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 2525),
    auth: { user, pass },
  });

  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM ?? "finance@northwindlabs.test",
      to: draft.toEmail,
      subject: draft.subject,
      text: draft.body,
    });
    return {
      sent: true,
      detail: `Message delivered to the Mailtrap sandbox inbox (id ${info.messageId}); it did not leave the sandbox.`,
    };
  } catch (err) {
    return {
      sent: false,
      detail: `Sandbox delivery failed (${err instanceof Error ? err.message : "unknown"}). The approval is still recorded.`,
    };
  }
}
