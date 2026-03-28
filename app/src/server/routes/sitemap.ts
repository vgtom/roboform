import type { RequestHandler } from "express";

type SitemapUrl = {
  path: string;
  changefreq: "daily" | "weekly";
  priority: number;
};

const SITE_ORIGIN = "https://vinforms.com";

const staticUrls: SitemapUrl[] = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/about", changefreq: "weekly", priority: 0.8 },
  { path: "/pricing", changefreq: "weekly", priority: 0.9 },
  { path: "/login", changefreq: "weekly", priority: 0.7 },
  { path: "/signup", changefreq: "weekly", priority: 0.8 },
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toUrlXml(
  url: SitemapUrl,
  lastmodIso: string,
): string {
  return [
    "  <url>",
    `    <loc>${escapeXml(`${SITE_ORIGIN}${url.path}`)}</loc>`,
    `    <lastmod>${lastmodIso}</lastmod>`,
    `    <changefreq>${url.changefreq}</changefreq>`,
    `    <priority>${url.priority.toFixed(1)}</priority>`,
    "  </url>",
  ].join("\n");
}

function buildSitemapXml(): string {
  const lastmodIso = new Date().toISOString();
  const urlNodes = staticUrls.map((url) => toUrlXml(url, lastmodIso)).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlNodes,
    "</urlset>",
    "",
  ].join("\n");
}

export const sitemapXmlHandler: RequestHandler = (_req, res) => {
  res.setHeader("Content-Type", "application/xml");
  res.status(200).send(buildSitemapXml());
};

/**
 * Placeholder for future dynamic routes, e.g. blog posts from a DB/CMS.
 * Keep this module as the single source for sitemap URL composition.
 */
export function getSitemapStaticUrls(): ReadonlyArray<SitemapUrl> {
  return staticUrls;
}
