import { NextResponse } from "next/server";
import { createRequestClient, createServiceClient } from "@/lib/supabase-server";
import { sendAccountDeletionEmail } from "@/lib/email";
import { captureServerEvent } from "@/lib/posthog-server";

export async function POST() {
  const requestClient = await createRequestClient();
  const { data: { user } } = await requestClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });

  const admin = createServiceClient();
  // Keep the audit event even after the auth user is deleted: audit_logs.actor_user_id
  // is intentionally nullable and is not FK-cascaded.
  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_user_id: user.id,
    event_type: "account_deleted",
    target_type: "user",
    target_id: user.id,
    metadata: { initiated_by: "self_service" },
  });
  if (auditError) return NextResponse.json({ error: "تعذر تسجيل عملية الحذف." }, { status: 500 });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "تعذر حذف الحساب حالياً." }, { status: 500 });

  await requestClient.auth.signOut();

  // Best-effort, fire-and-forget: never let email/analytics delay the
  // response or mask a deletion that already succeeded.
  if (user.email) void sendAccountDeletionEmail(user.email);
  void captureServerEvent(user.id, "account_deleted");

  return NextResponse.json({ ok: true });
}
