import OpenAI from "openai";
import {
  RECEIPT_EXTRACTION_SYSTEM_PROMPT,
  RECEIPT_EXTRACTION_USER_PROMPT,
} from "./prompts";
import {
  receiptExtractionResultSchema,
  type ReceiptExtractionResult,
  type ReceiptExtractor,
  type ReceiptImage,
} from "./types";
import { MOCK_EXTRACTION_RESULT } from "./mock-data";

export class ExtractionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Strip an accidental ```json fence and parse. */
function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(cleaned);
}

/**
 * Azure OpenAI extractor via the OpenAI-compatible /openai/v1 endpoint.
 * `model` is the Azure deployment name (e.g. "gpt-5-mini").
 */
export class AzureOpenAIExtractor implements ReceiptExtractor {
  private client: OpenAI;

  constructor(
    private readonly opts: { endpoint: string; apiKey: string; deployment: string },
  ) {
    this.client = new OpenAI({ baseURL: opts.endpoint, apiKey: opts.apiKey });
  }

  async extractReceiptProducts(image: ReceiptImage): Promise<ReceiptExtractionResult> {
    const dataUrl = `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;

    // One retry on malformed JSON / schema mismatch.
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.opts.deployment,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: RECEIPT_EXTRACTION_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: RECEIPT_EXTRACTION_USER_PROMPT },
                { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
              ],
            },
          ],
        });

        const text = response.choices[0]?.message?.content;
        if (!text) throw new ExtractionError("Model returned an empty response");
        return receiptExtractionResultSchema.parse(parseModelJson(text));
      } catch (err) {
        lastError = err;
      }
    }
    throw new ExtractionError(
      "Receipt extraction failed after retry. The image may not be a readable receipt.",
      lastError,
    );
  }
}

/** Deterministic mock used when no AI credentials are configured (dev/demo). */
export class MockExtractor implements ReceiptExtractor {
  async extractReceiptProducts(): Promise<ReceiptExtractionResult> {
    return receiptExtractionResultSchema.parse(MOCK_EXTRACTION_RESULT);
  }
}

/** Pick the configured extractor. Swap providers here (or add new ones). */
export function getExtractor(): ReceiptExtractor {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5-mini";

  if (endpoint && apiKey) {
    return new AzureOpenAIExtractor({ endpoint, apiKey, deployment });
  }

  // The mock must be opted into explicitly — silently returning demo data for a
  // real receipt would poison the price database.
  if (process.env.ALLOW_MOCK_EXTRACTOR === "true") {
    console.warn("Using the mock receipt extractor (ALLOW_MOCK_EXTRACTOR=true).");
    return new MockExtractor();
  }
  throw new ExtractionError(
    "Receipt extraction is not configured (AZURE_OPENAI_API_KEY is missing). " +
      "Set the Azure OpenAI env vars, or set ALLOW_MOCK_EXTRACTOR=true for demo data.",
  );
}
