import type { MetadataRoute } from "next";

const siteUrl = "https://www.aboslutt.no";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    "",
    "/pricing",
    "/contact",
    "/privacy",
    "/terms",
    "/terms/sales",
    "/login",
    "/register",
  ];

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/pricing" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/pricing" ? 0.9 : 0.6,
  }));
}
