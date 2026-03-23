import express from "express";
import type { MiddlewareConfigFn } from "wasp/server";

/**
 * Default `express.json()` uses a small body limit (~100kb). Voice transcription
 * sends base64-encoded audio in JSON action payloads (multi‑MB), which otherwise
 * returns **413 Payload Too Large** before `transcribeAudioForAiPrompt` runs.
 */
export const serverMiddlewareFn: MiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.set(
    "express.json",
    express.json({ limit: "15mb" }),
  );
  return middlewareConfig;
};
