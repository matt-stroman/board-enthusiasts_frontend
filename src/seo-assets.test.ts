import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = path.resolve(import.meta.dirname, "..");

describe("landing SEO assets", () => {
  it("includes core search and social metadata in index.html", () => {
    const html = readFileSync(path.join(frontendRoot, "index.html"), "utf8");

    expect(html).toContain('name="description"');
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).toContain('<link rel="canonical" href="https://boardenthusiasts.com/" />');
    expect(html).toContain('property="og:title" content="Board Enthusiasts | Community Hub for Board Players and Builders"');
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).toContain('rel="manifest" href="/site.webmanifest"');
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"@type": "WebSite"');
  });

  it("publishes a permissive robots.txt that points crawlers at the sitemap", () => {
    const robots = readFileSync(path.join(frontendRoot, "public", "robots.txt"), "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://boardenthusiasts.com/sitemap.xml");
  });

  it("publishes a sitemap with the landing page and privacy page", () => {
    const sitemap = readFileSync(path.join(frontendRoot, "public", "sitemap.xml"), "utf8");

    expect(sitemap).toContain("<loc>https://boardenthusiasts.com/</loc>");
    expect(sitemap).toContain("<loc>https://boardenthusiasts.com/privacy</loc>");
  });

  it("publishes a web manifest for installable browser metadata", () => {
    const manifest = readFileSync(path.join(frontendRoot, "public", "site.webmanifest"), "utf8");

    expect(manifest).toContain('"name": "Board Enthusiasts"');
    expect(manifest).toContain('"short_name": "BE"');
    expect(manifest).toContain('"theme_color": "#060811"');
  });
});
