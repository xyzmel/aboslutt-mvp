export const openCancellationStatuses = new Set([
  "draft",
  "ready",
  "sent",
  "awaiting_confirmation",
  "manual_required",
  "rejected",
]);

export const completedCancellationStatuses = new Set(["confirmed_cancelled"]);

export function getSubscriptionLifecycle(subscription) {
  const cancellationStatus =
    subscription?.cancellationStatus ?? subscription?.cancellationRequest?.status ?? subscription?.cancellationRequests?.[0]?.status ?? null;
  const status = subscription?.status ?? "active";

  if (status === "archived") {
    return createLifecycle("archived", cancellationStatus);
  }

  if (status === "cancelled" || completedCancellationStatuses.has(cancellationStatus)) {
    return createLifecycle("cancelled", cancellationStatus);
  }

  if (openCancellationStatuses.has(cancellationStatus)) {
    return createLifecycle("cancellation_in_progress", cancellationStatus);
  }

  return createLifecycle("active", cancellationStatus);
}

function createLifecycle(productStatus, cancellationStatus) {
  const labels = {
    active: "Aktiv",
    cancellation_in_progress: "Oppsigelse pågår",
    cancelled: "Abonnement avsluttet",
    archived: "Arkivert",
  };

  return {
    productStatus,
    cancellationStatus,
    label: labels[productStatus],
    appearsInActiveList: productStatus === "active" || productStatus === "cancellation_in_progress",
    appearsInHistory: productStatus === "cancelled",
    actions: getSubscriptionActions(productStatus),
  };
}

export function getSubscriptionActions(productStatus) {
  return {
    canEdit: productStatus === "active",
    canViewDetails: true,
    canStartCancellation: productStatus === "active",
    canContinueCancellation: productStatus === "cancellation_in_progress",
    canCompleteCancellation: productStatus === "cancellation_in_progress",
    canCancelCancellation: productStatus === "cancellation_in_progress",
    canArchive: productStatus === "cancelled",
    canRestore: productStatus === "archived",
    canDelete: productStatus === "cancelled" || productStatus === "archived",
    requiresDeletionConfirmation: productStatus === "cancelled" || productStatus === "archived",
  };
}

export function canDeleteSubscription(subscription) {
  return getSubscriptionLifecycle(subscription).actions.canDelete;
}

export function shouldIncludeUpcomingPayment(subscription) {
  return getSubscriptionLifecycle(subscription).productStatus === "active";
}

export function validateSubscriptionDeletion(subscription, confirmation) {
  const lifecycle = getSubscriptionLifecycle(subscription);

  if (!lifecycle.actions.canDelete) {
    return {
      ok: false,
      status: 409,
      error: "CANCELLATION_REQUIRED",
      message: "Abonnementet må avsluttes før det kan fjernes.",
      lifecycle,
    };
  }

  if (confirmation !== "SLETT") {
    return {
      ok: false,
      status: 400,
      error: "CONFIRMATION_REQUIRED",
      message: "Skriv SLETT for å bekrefte permanent sletting.",
      lifecycle,
    };
  }

  return { ok: true, lifecycle };
}
