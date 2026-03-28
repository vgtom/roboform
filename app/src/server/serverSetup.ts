import express from "express";
import type { MiddlewareConfigFn } from "wasp/server";
import { sitemapXmlHandler } from "./routes/sitemap";

/**
 * Default `express.json()` uses a small body limit (~100kb). Voice transcription
 * sends base64-encoded audio in JSON action payloads (multi‑MB), which otherwise
 * returns **413 Payload Too Large** before `transcribeAudioForAiPrompt` runs.
 */
export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  // Serve XML sitemap directly from the Wasp server.
  middlewareConfig.set("sitemap.xml", (req, res, next) => {
    if (req.path === "/sitemap.xml") {
      sitemapXmlHandler(req, res, next);
      return;
    }
    next();
  });

  middlewareConfig.set(
    "express.json",
    express.json({ limit: "15mb" }),
  );
  return middlewareConfig;
};
