import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/dashboard",
          "/import",
          "/onboarding",
          "/settings",
          "/subscriptions",
          "/payment",
        ],
      },
    ],
    sitemap: "https://www.aboslutt.no/sitemap.xml",
  };
}
