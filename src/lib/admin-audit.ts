import { prisma } from "@/lib/prisma";

type AdminAuditInput = {
  adminUserId: string;
  action: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAdminAudit({
  adminUserId,
  action,
  targetUserId = null,
  metadata = {},
}: AdminAuditInput) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      action,
      targetUserId,
      metadataJson: JSON.stringify(sanitizeAuditMetadata(metadata)),
    },
    select: { id: true },
  });
}

function sanitizeAuditMetadata(metadata: Record<string, unknown>) {
  const blocked = /token|secret|password|authorization|cookie|gmail|raw|access|refresh/i;

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !blocked.test(key))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 300) : value]),
  );
}
