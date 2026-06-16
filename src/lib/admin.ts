import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

type AdminCandidate = {
  email: string | null;
};

export class AdminForbiddenError extends Error {
  constructor(message = "Du har ikke tilgang til admin.") {
    super(message);
    this.name = "AdminForbiddenError";
  }
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: AdminCandidate | null | undefined) {
  const email = user?.email?.trim().toLowerCase();

  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email);
}

export async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAdminUser(user)) {
    throw new AdminForbiddenError();
  }

  return user;
}
