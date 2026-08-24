import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// No domain is verified on the Resend account yet, so this falls back to
// Resend's shared onboarding@resend.dev sender. That sender can only
// deliver to the Resend account owner's own verified address — fine for
// testing, NOT fine for real students. Verify a domain (e.g. najah.ma or
// mail.najah.ma) in Resend and set RESEND_FROM_EMAIL before going live.
const FROM = process.env.RESEND_FROM_EMAIL ?? "Najah.ma <onboarding@resend.dev>";

/**
 * Confirms an account deletion after it has already happened server-side
 * (see app/api/account/delete/route.ts). This is best-effort and must never
 * block or fail the deletion itself — a missed email is not worth blocking
 * a student's right to delete their data.
 */
export async function sendAccountDeletionEmail(to: string) {
  if (!resend) {
    console.warn("RESEND_API_KEY is not configured; skipping account deletion email.");
    return;
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "تم حذف حسابك في Najah.ma",
      text:
        "تم حذف حسابك وكل بياناتك المرتبطة به من منصة Najah.ma بنجاح.\n" +
        "إذا لم تكن أنت من طلب هذا الحذف، تواصل معنا فوراً.",
    });
  } catch (err) {
    // Swallow — logged to Sentry via the caller's existing error reporting,
    // deletion has already succeeded and must not be rolled back for this.
    console.error("Failed to send account deletion email:", err);
  }
}
