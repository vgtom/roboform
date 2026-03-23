import OpenAI, { toFile } from "openai";
import { HttpError, prisma } from "wasp/server";
import type { TranscribeAudioForAiPrompt } from "wasp/server/operations";
import * as z from "zod";
import {
  assertRoomForSecondAiStep,
  ensureAiUsageBillingPeriodAligned,
} from "./aiUsageBillingPeriod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";
import { PaymentPlanId, hasVoiceInputAccess } from "../payment/plans";

/** Whisper accepts up to 25MB; keep a lower cap for request size and UX. */
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/m4a",
];

const transcribeAudioSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().min(1).max(120),
});

export const transcribeAudioForAiPrompt: TranscribeAudioForAiPrompt<
  z.infer<typeof transcribeAudioSchema>,
  { text: string }
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401, "Authentication required");
  }

  const plan =
    (context.user.subscriptionPlan as PaymentPlanId) || PaymentPlanId.Free;
  if (!hasVoiceInputAccess(plan)) {
    throw new HttpError(
      403,
      "Voice input is available on the Ultimate plan only. Upgrade to use voice-based AI prompts.",
    );
  }

  await ensureAiUsageBillingPeriodAligned(context.user.id, prisma);
  await assertRoomForSecondAiStep(context.user.id, prisma);

  const { audioBase64, mimeType } = ensureArgsSchemaOrThrowHttpError(
    transcribeAudioSchema,
    rawArgs,
  );

  const normalizedMime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) =>
    normalizedMime.startsWith(prefix),
  );
  if (!allowed) {
    throw new HttpError(
      400,
      `Unsupported audio type: ${mimeType}. Use a supported browser recording format.`,
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError(500, "OpenAI API key not configured");
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(audioBase64, "base64");
  } catch {
    throw new HttpError(400, "Invalid audio data");
  }

  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new HttpError(
      400,
      "Recording is too large. Try speaking for a shorter time (max ~2 minutes).",
    );
  }
  if (buffer.length < 80) {
    throw new HttpError(400, "Recording too short. Hold the mic and speak, then tap again to stop.");
  }

  const ext =
    normalizedMime.includes("webm") ? "webm"
    : normalizedMime.includes("mp4") || normalizedMime.includes("m4a") ? "m4a"
    : normalizedMime.includes("mpeg") || normalizedMime.includes("mp3") ? "mp3"
    : normalizedMime.includes("wav") ? "wav"
    : "webm";

  const file = await toFile(buffer, `recording.${ext}`, { type: mimeType });

  const openai = new OpenAI({ apiKey });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    // Count as soon as OpenAI accepts the Whisper request (billed per their pricing). Includes
    // “failed” UX outcomes (e.g. empty transcript) whenever the API call completed successfully.
    await prisma.user.update({
      where: { id: context.user.id },
      data: { aiUsageCount: { increment: 1 } },
    });

    const text = transcription.text?.trim() ?? "";
    if (!text) {
      throw new HttpError(
        400,
        "Could not transcribe speech. Try again or speak more clearly.",
      );
    }

    return { text };
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Transcription failed";
    console.error("[transcribeAudioForAiPrompt]", err);
    throw new HttpError(500, `Transcription failed: ${message}`);
  }
};
