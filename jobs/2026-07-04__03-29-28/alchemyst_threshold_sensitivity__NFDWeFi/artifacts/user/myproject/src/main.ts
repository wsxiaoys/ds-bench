/**
 * Alchemyst AI Threshold Sensitivity CLI.
 *
 * Usage:
 *   node dist/main.js --thresholds <csv>
 *
 * Environment:
 *   ALCHEMYST_AI_API_KEY  - required API key
 *
 * Behavior:
 *   1. Reads the run-id from /logs/artifacts/run-id.
 *   2. Ingests a small corpus of documents into Alchemyst AI. Documents use
 *      deterministic, run-id-specific file_name values so concurrent runs do
 *      not collide. 409 Conflict responses are treated as success.
 *   3. Performs v1.context.search at every requested threshold and prints a
 *      single JSON object to stdout.
 */

import * as fs from "node:fs";
import AlchemystAI, { ConflictError, APIError } from "@alchemystai/sdk";

const SCOPE = "internal" as const;
const SOURCE = "threshold-sensitivity-demo";
const CONTEXT_TYPE = "resource" as const;
const RUN_ID_PATH = "/logs/artifacts/run-id";
const FIXED_QUERY =
  "What is the refund policy for damaged items and how do I request one?";

interface CliArgs {
  thresholds: number[];
}

interface ThresholdDoc {
  fileName: string;
  content: string;
}

/**
 * Parse CLI arguments of the form `--thresholds 0.5,0.7,0.9`.
 */
function parseArgs(argv: string[]): CliArgs {
  const thresholdsFlagIndex = argv.indexOf("--thresholds");
  if (thresholdsFlagIndex === -1 || thresholdsFlagIndex === argv.length - 1) {
    throw new Error(
      "Missing required argument: --thresholds <csv> (e.g. --thresholds 0.5,0.7,0.9)"
    );
  }

  const raw = argv[thresholdsFlagIndex + 1];
  const parts = raw.split(",").map((p) => p.trim()).filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error("--thresholds must contain at least one numeric value");
  }

  const thresholds: number[] = [];
  for (const part of parts) {
    const value = Number(part);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid threshold value: ${part}`);
    }
    if (value < 0 || value > 1) {
      throw new Error(
        `Threshold ${value} is out of range [0, 1]`
      );
    }
    thresholds.push(value);
  }

  return { thresholds };
}

/**
 * Read the run-id from the fixed artifact path. Required to scope file_name
 * values per concurrent run.
 */
function readRunId(): string {
  try {
    const contents = fs.readFileSync(RUN_ID_PATH, "utf-8").trim();
    if (!contents) {
      throw new Error(`run-id file at ${RUN_ID_PATH} is empty`);
    }
    return contents;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to read run-id from ${RUN_ID_PATH}: ${msg}`);
  }
}

/**
 * Build the corpus: a few clearly on-topic documents, a few tangentially
 * related, and a few clearly off-topic. Designed so that:
 *   - count(threshold=0.5) strictly exceeds count(threshold=0.9)
 *   - counts are monotonically non-increasing as the threshold increases
 */
function buildCorpus(runId: string): ThresholdDoc[] {
  const onTopic: string[] = [
    "Our refund policy: customers may return any item within 30 days of delivery for a full refund. Items damaged during shipping are eligible for a full refund, including free return shipping arranged by our support team. To start a damaged-item refund, email support@example.com with your order number and a short description or photo of the damage. Once approved, refunds are credited back to the original payment method within 5 to 7 business days after we receive the returned item. No restocking fee is applied to damaged-in-shipment refunds.",
    "Damaged items refund procedure: if your order arrives damaged, contact our support team within 14 days of delivery at support@example.com to file a damaged-item claim. Please include your order number, a description of the damage, and a clear photo so we can process the refund quickly. Approved damaged-item claims receive a prepaid return label and a full refund including any original shipping charges. This policy is part of our standard 30-day refund guarantee and applies to both physical damage and manufacturing defects.",
    "How long do refunds take to process? For damaged items we issue the refund as soon as the claim is approved, typically the same business day. Once the refund is issued, banks and card issuers post the credit to your account within 5 to 7 business days, though some processors may take up to 10 business days. We will email you a refund confirmation the moment the refund is initiated. If you do not see the credit after 10 business days, contact support@example.com and we will trace the refund with the processor for you.",
  ];

  const tangential: string[] = [
    "Shipping policy overview: we ship orders within 1 to 2 business days from our fulfillment center. Standard delivery takes 5 to 7 business days within the continental United States, and 7 to 14 business days for international destinations. Free standard shipping is available on orders over fifty dollars. Express and overnight shipping options are offered at checkout for customers who need their order faster.",
    "Customer support availability: our support team is reachable 24 hours a day, 7 days a week via email at support@example.com and via live chat during business hours from 9am to 9pm in your local time zone. Phone support is available for urgent order issues. The fastest way to reach us for general questions is email, and we typically reply within a few business hours.",
    "How to contact our customer support team: we can be reached by email at support@example.com, by phone at 1-800-555-0199 during business hours, or via the chat widget on our website. Our postal address and headquarters information is listed on the contact page. For order-specific questions please include your order number so we can assist you quickly.",
  ];

  const offTopic: string[] = [
    "The Pythagorean theorem states that in a right triangle, the square of the length of the hypotenuse equals the sum of the squares of the lengths of the other two sides. This relationship is written as a squared plus b squared equals c squared, where c is the hypotenuse. The theorem is fundamental to Euclidean geometry and has applications in surveying, navigation, and engineering.",
    "Chocolate chip cookie recipe: preheat the oven to 375 degrees Fahrenheit. Cream together one cup of softened butter with three quarters of a cup of granulated sugar and three quarters of a cup of packed brown sugar. Beat in two large eggs and one teaspoon of vanilla extract. In a separate bowl whisk together two and a quarter cups of all-purpose flour, one teaspoon of baking soda, and one half teaspoon of salt. Gradually mix the dry ingredients into the wet mixture, then stir in two cups of semisweet chocolate chips. Drop rounded tablespoons of dough onto ungreased baking sheets and bake for 9 to 11 minutes until golden brown.",
    "Astronomy notes: the solar system consists of the Sun at the center and the objects that orbit it, including eight planets, dwarf planets, moons, asteroids, and comets. The four terrestrial planets closest to the Sun are Mercury, Venus, Earth, and Mars. Beyond Mars lies the asteroid belt, followed by the four gas giants Jupiter, Saturn, Uranus, and Neptune. Distances within the solar system are typically measured in astronomical units, where one AU equals the average distance from Earth to the Sun.",
    "Marathon training plan for beginners: start by running three days per week with one short easy run, one tempo run, and one long run that gradually increases in distance. Build up the long run by about one mile each week until you can comfortably run twenty miles in a single session. Add cross training and strength work on the off days, and make sure to take at least one full rest day per week. Most beginner marathon plans run for sixteen to twenty weeks of consistent training before the race.",
  ];

  const docs: string[] = [...onTopic, ...tangential, ...offTopic];
  return docs.map((content, idx) => ({
    fileName: `threshold_doc_${idx.toString().padStart(2, "0")}_${runId}.md`,
    content,
  }));
}

/**
 * Sleep helper used for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine whether an error from the SDK represents a 409 Conflict.
 * The SDK throws a typed ConflictError for 409s but we also fall back to
 * inspecting the status property and message for robustness.
 */
function isConflictError(err: unknown): boolean {
  if (err instanceof ConflictError) {
    return true;
  }
  if (err instanceof APIError && err.status === 409) {
    return true;
  }
  if (err && typeof err === "object") {
    const anyErr = err as { status?: number; statusCode?: number; code?: string };
    if (anyErr.status === 409 || anyErr.statusCode === 409) {
      return true;
    }
    if (anyErr.code === "CONFLICT" || anyErr.code === "conflict") {
      return true;
    }
  }
  return false;
}

/**
 * Determine whether an error is a transient rate limit that warrants retry.
 */
function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const anyErr = err as { status?: number; statusCode?: number; code?: string };
    if (anyErr.status === 429 || anyErr.statusCode === 429) {
      return true;
    }
    if (anyErr.code === "RATE_LIMIT" || anyErr.code === "rate_limit") {
      return true;
    }
  }
  return false;
}

/**
 * Ingest the corpus into Alchemyst. 409 conflicts (duplicate file_name) are
 * treated as success so that re-running with the same run-id is idempotent.
 */
async function ingestCorpus(
  client: AlchemystAI,
  docs: ThresholdDoc[],
  runId: string,
  maxAttempts = 3
): Promise<void> {
  const payload = {
    context_type: CONTEXT_TYPE,
    scope: SCOPE,
    source: SOURCE,
    documents: docs.map((d) => ({
      content: d.content,
      metadata: {
        fileName: d.fileName,
        fileType: "text/markdown",
        groupName: ["threshold-sensitivity", `run-${runId}`],
      },
    })),
  };

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await client.v1.context.add(payload);
      process.stderr.write(
        `[ingest] Documents accepted (attempt ${attempt}): ${JSON.stringify(
          resp
        )}\n`
      );
      return;
    } catch (err) {
      lastErr = err;
      if (isConflictError(err)) {
        // Document already stored under this file_name -- idempotent success.
        process.stderr.write(
          `[ingest] 409 Conflict on attempt ${attempt}; treating as already stored.\n`
        );
        return;
      }
      if (isRateLimitError(err) && attempt < maxAttempts) {
        const backoffMs = 500 * attempt;
        process.stderr.write(
          `[ingest] Rate limited on attempt ${attempt}; backing off ${backoffMs}ms.\n`
        );
        await sleep(backoffMs);
        continue;
      }
      // On the last attempt for non-conflict errors, break out and rethrow.
      if (attempt >= maxAttempts) {
        break;
      }
      const backoffMs = 250 * attempt;
      process.stderr.write(
        `[ingest] Error on attempt ${attempt}, retrying in ${backoffMs}ms: ${
          err instanceof Error ? err.message : String(err)
        }\n`
      );
      await sleep(backoffMs);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Run a search at the supplied threshold. Defends against transient rate-limit
 * errors with a small backoff loop.
 */
async function countContextsAtThreshold(
  client: AlchemystAI,
  threshold: number,
  maxAttempts = 3
): Promise<number> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await client.v1.context.search({
        query: FIXED_QUERY,
        // We want all chunks with similarity >= threshold. The SDK treats
        // similarity_threshold as the upper bound; using 1 as the upper bound
        // means "no upper limit", making the search behave as score >= threshold.
        similarity_threshold: 1,
        minimum_similarity_threshold: threshold,
        scope: SCOPE,
      });
      const contexts = resp.contexts ?? [];
      return contexts.length;
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err) && attempt < maxAttempts) {
        const backoffMs = 500 * attempt;
        process.stderr.write(
          `[search] Rate limited at threshold ${threshold} attempt ${attempt}; backing off ${backoffMs}ms.\n`
        );
        await sleep(backoffMs);
        continue;
      }
      if (attempt >= maxAttempts) {
        break;
      }
      const backoffMs = 200 * attempt;
      process.stderr.write(
        `[search] Error at threshold ${threshold} attempt ${attempt}, retrying in ${backoffMs}ms: ${
          err instanceof Error ? err.message : String(err)
        }\n`
      );
      await sleep(backoffMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function main(): Promise<void> {
  // 1. CLI args
  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(
      `[error] ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(2);
  }

  // 2. API key check
  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    process.stderr.write(
      "[error] ALCHEMYST_AI_API_KEY environment variable is not set.\n"
    );
    process.exit(3);
  }

  // 3. Read run-id
  let runId: string;
  try {
    runId = readRunId();
  } catch (err) {
    process.stderr.write(
      `[error] ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(4);
  }
  process.stderr.write(`[info] Using run-id: ${runId}\n`);

  // 4. Initialize client (silence noisy SDK stderr logs)
  const client = new AlchemystAI({
    apiKey,
    logLevel: "error",
  });

  // 5. Build + ingest corpus
  const corpus = buildCorpus(runId);
  process.stderr.write(`[info] Ingesting ${corpus.length} documents...\n`);
  try {
    await ingestCorpus(client, corpus, runId);
  } catch (err) {
    process.stderr.write(
      `[error] Ingestion failed: ${
        err instanceof Error ? err.message : String(err)
      }\n`
    );
    process.exit(5);
  }

  // 6. Run searches
  const results: { threshold: number; count: number }[] = [];
  for (const t of args.thresholds) {
    let count: number;
    try {
      count = await countContextsAtThreshold(client, t);
    } catch (err) {
      process.stderr.write(
        `[error] Search failed at threshold ${t}: ${
          err instanceof Error ? err.message : String(err)
        }\n`
      );
      process.exit(6);
    }
    process.stderr.write(`[info] threshold=${t} -> count=${count}\n`);
    results.push({ threshold: t, count });
  }

  // 7. Print the JSON result on stdout
  const output = JSON.stringify({ query: FIXED_QUERY, results });
  process.stdout.write(output + "\n");
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(
    `[fatal] ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
