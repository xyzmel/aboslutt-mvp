import { NextResponse } from "next/server";
import { isCheckoutPlanId } from "@/lib/billing/plans";
import { createVippsCheckoutPlaceholder, isVippsPaymentConfigured } from "@/lib/billing/vipps";
import { getCurrentUser, unauthorizedResponse } from "@/lib/current-user";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return unauthorizedResponse();
  }

  const payload = (await request.json().catch(() => ({}))) as { plan?: unknown };
  const plan = typeof payload.plan === "string" ? payload.plan : "";

  if (!isCheckoutPlanId(plan)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PLAN", message: "Ugyldig betalingsplan." },
      { status: 400 },
    );
  }

  if (!isVippsPaymentConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "PAYMENTS_NOT_CONFIGURED",
        message: "Betaling er ikke aktivert ennå.",
      },
      { status: 503 },
    );
  }

  await createVippsCheckoutPlaceholder();

  return NextResponse.json(
    {
      ok: false,
      error: "PAYMENTS_NOT_IMPLEMENTED",
      message: "Vipps-betaling er konfigurert, men checkout er ikke implementert ennå.",
    },
    { status: 501 },
  );
}
