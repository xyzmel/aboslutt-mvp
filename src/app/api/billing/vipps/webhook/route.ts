import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Verify Vipps webhook signature/authorization when payment credentials
  // are approved. Only after a verified payment/recurring event should the app
  // update User.plan to "premium". Do not process fake or unsigned payments.
  return NextResponse.json({
    ok: true,
    received: true,
    message: "Vipps webhook placeholder. Ingen betaling er behandlet.",
  });
}
