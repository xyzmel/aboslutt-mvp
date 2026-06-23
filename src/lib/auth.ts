import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import {
  getGoogleAuthScope,
  isMicrosoftLoginConfigured,
  microsoftCommonWellKnownUrl,
  microsoftLoginProviderId,
  microsoftLoginScope,
} from "@/lib/auth-provider-config.mjs";
import nodemailer from "nodemailer";
import {
  isEmailConfigured,
  isVippsConfigured,
  logAuthConfigStatusInDevelopment,
} from "@/lib/auth-config-status";
import { validateEmailMagicLinkRequest } from "@/lib/beta";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { trackServerFunnelEvent } from "@/lib/server-analytics";
import { createSanitizedAuthAdapter } from "@/lib/auth-account-sanitizer.mjs";
import { logger } from "@/lib/logger";

type VippsProfile = {
  sub: string;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  phone_number?: string | null;
};

const vippsClientId = process.env.VIPPS_CLIENT_ID?.trim();
const vippsClientSecret = process.env.VIPPS_CLIENT_SECRET?.trim();
const vippsWellKnownUrl = process.env.VIPPS_WELL_KNOWN_URL?.trim();
const smtpConfigured = isEmailConfigured();
export const sessionStrategy = "jwt" as const;

logAuthConfigStatusInDevelopment();

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: "credentials",
    name: "E-post og passord",
    credentials: {
      email: { label: "E-post", type: "email" },
      password: { label: "Passord", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password ?? "";

      if (!email || !password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          passwordHash: true,
        },
      });

      if (!user?.passwordHash) {
        return null;
      }

      if (!user.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }

      const passwordMatches = await verifyPassword(password, user.passwordHash);

      if (!passwordMatches) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    // Allowed for beta because Google emails are verified; review before full production.
    allowDangerousEmailAccountLinking: true,
    authorization: {
      params: {
        scope: getGoogleAuthScope(),
        access_type: "offline",
        prompt: "consent",
        response_type: "code",
      },
    },
  }),
];

if (smtpConfigured) {
  providers.unshift(
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        secure: Number(process.env.EMAIL_SERVER_PORT ?? 587) === 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url, provider }) {
        const transport = nodemailer.createTransport(provider.server);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: "Logg inn på Aboslutt",
          text: [
            "Hei!",
            "",
            "Bruk lenken under for å logge inn på Aboslutt:",
            url,
            "",
            "Lenken er tidsbegrenset og skal bare brukes av deg. Hvis du ikke ba om denne e-posten, kan du se bort fra den.",
          ].join("\n"),
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0D1B2A;">
              <h1>Logg inn på Aboslutt</h1>
              <p>Bruk knappen under for å logge inn. Ingen passord trengs.</p>
              <p><a href="${url}" style="display:inline-block;background:#C8102E;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Logg inn</a></p>
              <p>Lenken er tidsbegrenset og skal bare brukes av deg. Hvis du ikke ba om denne e-posten, kan du se bort fra den.</p>
            </div>
          `,
        });
      },
    }),
  );
}

if (isMicrosoftLoginConfigured()) {
  providers.push({
    id: microsoftLoginProviderId,
    name: "Microsoft",
    type: "oauth",
    wellKnown: microsoftCommonWellKnownUrl,
    clientId: process.env.MICROSOFT_CLIENT_ID?.trim(),
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET?.trim(),
    authorization: {
      params: {
        scope: microsoftLoginScope,
        response_type: "code",
      },
    },
    checks: ["pkce", "state", "nonce"],
    idToken: true,
    // Microsoft returns extra token metadata that is not part of our Account
    // schema. The adapter wrapper below persists only explicitly supported fields.
    // The OIDC identity allows a retry to link an orphaned user created before a
    // failed adapter write, without touching the separate Outlook mailbox account.
    allowDangerousEmailAccountLinking: true,
    profile(profile: MicrosoftLoginProfile) {
      return {
        id: profile.sub,
        name: profile.name ?? null,
        email: profile.email ?? profile.preferred_username ?? null,
        image: null,
      };
    },
  });
}

if (isVippsConfigured()) {
  providers.push({
    id: "vipps",
    name: "Vipps",
    type: "oauth",
    wellKnown: vippsWellKnownUrl,
    clientId: vippsClientId,
    clientSecret: vippsClientSecret,
    // Allowed for beta because Vipps Login account data is trusted; review before full production.
    allowDangerousEmailAccountLinking: true,
    authorization: {
      params: {
        scope: "openid name phoneNumber email",
        response_type: "code",
      },
    },
    checks: ["pkce", "state"],
    idToken: true,
    profile(profile: VippsProfile) {
      return {
        id: profile.sub,
        name: profile.name ?? null,
        email: profile.email ?? null,
        image: null,
        phoneNumber: profile.phoneNumber ?? profile.phone_number ?? null,
      };
    },
  });
}

export const authOptions: NextAuthOptions = {
  adapter: createSanitizedAuthAdapter(PrismaAdapter(prisma)),
  // OAuth account rows can contain access, refresh and ID tokens.
  // Never print provider account payloads or token values in logs.
  providers,
  session: {
    strategy: sessionStrategy,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production" && process.env.NEXTAUTH_DEBUG === "true",
  logger: {
    error(code, metadata) {
      logger.error("[auth:error]", {
        code,
        error: metadata instanceof Error ? metadata : metadata.error,
      });
    },
    warn(code) {
      logger.warn("[auth:warning]", { code });
    },
    debug(code) {
      if (process.env.NODE_ENV !== "production") {
        logger.info("[auth:debug]", { code });
      }
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.id = user.id;
      }

      if (account?.provider) {
        token.provider = account.provider;
      }

      if (account?.provider === "google" && user?.id && account.providerAccountId) {
        await preserveGoogleRefreshToken({
          userId: user.id,
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          tokenType: account.token_type,
          scope: account.scope,
          idToken: account.id_token,
        });
      }

      if (!token.id && token.email) {
        const databaseUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true },
        });
        token.id = databaseUser?.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = getTokenId(token);
        session.user.email = token.email ?? session.user.email ?? null;
        session.user.name = token.name ?? session.user.name ?? null;
        session.user.image = token.picture ?? session.user.image ?? null;
        session.user.provider = typeof token.provider === "string" ? token.provider : null;
      }

      return session;
    },
    async signIn({ user, account, email, profile }) {
      if (account?.provider === "vipps" && user.id) {
        await updateVippsProfileFields(user.id, profile);
        return true;
      }

      if (account?.provider === "google" && user.id) {
        if (account.scope?.split(" ").includes("https://www.googleapis.com/auth/gmail.readonly")) {
          trackServerFunnelEvent("email_provider_connected", { provider: "gmail", result: "success" }, user.id);
        }
        return true;
      }

      if (account?.provider === microsoftLoginProviderId && user.id) {
        return true;
      }

      if (account?.provider === "credentials" && user.id) {
        return true;
      }

      if (account?.provider === "email" && !email?.verificationRequest && user.id) {
        return true;
      }

      if (account?.provider !== "email" || !email?.verificationRequest) {
        return true;
      }

      const userEmail = user.email;
      if (!userEmail) {
        return false;
      }

      const result = await validateEmailMagicLinkRequest(userEmail, "login");
      return result.allowed;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (!user.id) {
        return;
      }

      trackLoginCompleted(user.id, getLoginMethod(account?.provider));
    },
  },
};

type MicrosoftLoginProfile = {
  sub: string;
  name?: string | null;
  email?: string | null;
  preferred_username?: string | null;
};

function trackLoginCompleted(userId: string, method: string) {
  trackServerFunnelEvent("login_completed", { method }, userId);
}

function getLoginMethod(provider?: string | null) {
  if (provider === microsoftLoginProviderId) {
    return "microsoft";
  }

  if (provider === "google" || provider === "vipps") {
    return provider;
  }

  return "credentials";
}

function getTokenId(token: JWT) {
  if (typeof token.id === "string") {
    return token.id;
  }

  return token.sub ?? "";
}

async function updateVippsProfileFields(userId: string, profile: unknown) {
  const vippsProfile = profile as VippsProfile | undefined;
  const phoneNumber = vippsProfile?.phoneNumber ?? vippsProfile?.phone_number ?? null;

  if (!phoneNumber) {
    return;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { phoneNumber },
      select: { id: true },
    });
  } catch {
    // Never log OAuth profile payloads or tokens. Missing phone persistence should
    // not block sign-in.
  }
}

async function preserveGoogleRefreshToken({
  userId,
  providerAccountId,
  accessToken,
  refreshToken,
  expiresAt,
  tokenType,
  scope,
  idToken,
}: {
  userId: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
}) {
  const data = {
    access_token: accessToken ?? undefined,
    expires_at: expiresAt ?? undefined,
    token_type: tokenType ?? undefined,
    scope: scope ?? undefined,
    id_token: idToken ?? undefined,
    refresh_token: refreshToken ?? undefined,
  };

  try {
    await prisma.account.updateMany({
      where: {
        userId,
        provider: "google",
        providerAccountId,
      },
      data,
    });
  } catch {
    // Never log OAuth token payloads. A failed opportunistic token update should
    // not block sign-in; Gmail import will ask the user to reconnect if needed.
  }
}
