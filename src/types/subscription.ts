export type SubscriptionCategory = "streaming" | "software" | "news" | "health";

export type SubscriptionStatus = "active" | "trial" | "yearly" | "cancelled";

export type BillingInterval = "monthly" | "yearly" | "unknown";

export type Subscription = {
  id: string;
  providerId?: string | null;
  provider?: {
    id: string;
    name: string;
    slug: string;
    category: string;
    logoPath?: string | null;
  } | null;
  name: string;
  normalizedName?: string | null;
  category: SubscriptionCategory;
  monthlyCost: number;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  nextPayment: string;
  note?: string | null;
  source?: string | null;
  confidence?: number | null;
  cancellationStatus?: string | null;
  cancellationRequest?: {
    id: string;
    status: string;
    sentAt?: string | null;
    updatedAt?: string | null;
  } | null;
  createdAt?: string;
};
