export type ProductSubscriptionStatus = "active" | "cancellation_in_progress" | "cancelled" | "archived";

export type SubscriptionLifecycleInput = {
  status?: string | null;
  cancellationStatus?: string | null;
  cancellationRequest?: { status?: string | null } | null;
  cancellationRequests?: { status?: string | null }[] | null;
};

export type SubscriptionActions = {
  canEdit: boolean;
  canViewDetails: boolean;
  canStartCancellation: boolean;
  canContinueCancellation: boolean;
  canCompleteCancellation: boolean;
  canCancelCancellation: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
  requiresDeletionConfirmation: boolean;
};

export type SubscriptionLifecycle = {
  productStatus: ProductSubscriptionStatus;
  cancellationStatus: string | null;
  label: string;
  appearsInActiveList: boolean;
  appearsInHistory: boolean;
  actions: SubscriptionActions;
};

export const openCancellationStatuses: Set<string>;
export const completedCancellationStatuses: Set<string>;
export function getSubscriptionLifecycle(subscription: SubscriptionLifecycleInput): SubscriptionLifecycle;
export function getSubscriptionActions(productStatus: ProductSubscriptionStatus): SubscriptionActions;
export function canDeleteSubscription(subscription: SubscriptionLifecycleInput): boolean;
export function shouldIncludeUpcomingPayment(subscription: SubscriptionLifecycleInput): boolean;
export function validateSubscriptionDeletion(
  subscription: SubscriptionLifecycleInput,
  confirmation?: string | null,
):
  | { ok: true; lifecycle: SubscriptionLifecycle }
  | { ok: false; status: number; error: string; message: string; lifecycle: SubscriptionLifecycle };
