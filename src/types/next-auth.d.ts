import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    authenticatedAt?: number;
    user?: {
      id: string;
      provider?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    provider?: string | null;
    authenticatedAt?: number;
  }
}
