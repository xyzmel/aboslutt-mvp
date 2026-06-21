import { NextResponse } from "next/server";
import {
  reconcileBillingAgreementById,
  reconcileStalePendingBillingAgreements,
} from "@/lib/billing/reconcile";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUser } from "@/lib/current-user";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isAdminUser(currentUser)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as { agreementId?: unknown };
  const agreementId = typeof payload.agreementId === "string" ? payload.agreementId.trim() : "";

  if (agreementId) {
    const result = await reconcileBillingAgreementById(agreementId);

    logger.info("[billing:admin-reconcile]", {
      adminUserId: currentUser.id,
      agreementId,
      reference: result.reference,
      ok: result.ok,
      changed: result.changed,
      nextStatus: result.nextStatus,
      vippsStatus: result.vippsStatus,
      error: result.error,
    });

    return NextResponse.json({ ok: result.ok, result });
  }

  const result = await reconcileStalePendingBillingAgreements();

  logger.info("[billing:admin-reconcile]", {
    adminUserId: currentUser.id,
    checked: result.checked,
    changed: result.results.filter((item) => item.changed).length,
  });

  return NextResponse.json({ ok: true, ...result });
}
