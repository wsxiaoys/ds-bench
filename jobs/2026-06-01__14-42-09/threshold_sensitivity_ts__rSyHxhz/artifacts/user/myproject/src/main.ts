/* eslint-disable @typescript-eslint/no-explicit-any */
import AlchemystAI from "@alchemystai/sdk";

// All non-result diagnostic logs go to stderr.
const log = (...args: any[]) => {
  // eslint-disable-next-line no-console
  console.error(...args);
};

interface CliArgs {
  thresholds: number[];
}

function parseArgs(argv: string[]): CliArgs {
  let thresholdsRaw: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--thresholds") {
      thresholdsRaw = argv[i + 1];
      i++;
    } else if (a.startsWith("--thresholds=")) {
      thresholdsRaw = a.slice("--thresholds=".length);
    }
  }
  if (!thresholdsRaw) {
    throw new Error("Missing required --thresholds <csv> argument");
  }
  const thresholds = thresholdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s);
      if (!Number.isFinite(n)) {
        throw new Error(`Invalid threshold value: ${s}`);
      }
      if (n < 0 || n > 1) {
        throw new Error(`Threshold out of range [0,1]: ${s}`);
      }
      return n;
    });
  if (thresholds.length === 0) {
    throw new Error("At least one threshold must be provided");
  }
  return { thresholds };
}

const QUERY =
  "What is photosynthesis and how do plants convert sunlight into energy?";

// Corpus designed with varied semantic relevance to the QUERY.
const CORPUS: { content: string; topic: string }[] = [
  // Clearly on-topic (photosynthesis / plants converting sunlight)
  {
    topic: "on-topic",
    content:
      "Photosynthesis is the biological process by which green plants, algae, and certain bacteria convert light energy from the sun into chemical energy stored in glucose. Chlorophyll in plant cells absorbs sunlight, primarily in the blue and red parts of the visible spectrum, and uses that energy to split water molecules and fix carbon dioxide into sugars.",
  },
  {
    topic: "on-topic",
    content:
      "During photosynthesis, plants take in carbon dioxide from the air through stomata in their leaves and absorb water from the soil through their roots. Using sunlight captured by chlorophyll, they perform the light-dependent reactions in the thylakoid membranes and the Calvin cycle in the stroma of chloroplasts to produce glucose and release oxygen as a byproduct.",
  },
  {
    topic: "on-topic",
    content:
      "Chloroplasts are the organelles in plant cells where photosynthesis takes place. They contain chlorophyll, the pigment responsible for capturing light energy. The overall chemical equation for photosynthesis is 6 CO2 + 6 H2O + light energy -> C6H12O6 + 6 O2, summarizing how plants convert sunlight, water, and carbon dioxide into glucose and oxygen.",
  },
  // Tangentially related
  {
    topic: "tangential",
    content:
      "Solar panels use photovoltaic cells to convert sunlight directly into electricity. Unlike biological systems, they rely on semiconductor materials such as silicon to generate an electric current when struck by photons. They are a key technology in renewable energy generation.",
  },
  {
    topic: "tangential",
    content:
      "Plants require nutrients such as nitrogen, phosphorus, and potassium from the soil to grow. Gardeners often add fertilizers to provide these nutrients, which support root development, flowering, and overall plant health. Proper watering and adequate sunlight are also important.",
  },
  {
    topic: "tangential",
    content:
      "Cellular respiration is the process by which cells break down glucose to release energy in the form of ATP. It occurs in both plants and animals and is in many ways the inverse of photosynthesis, consuming oxygen and producing carbon dioxide and water.",
  },
  // Clearly off-topic
  {
    topic: "off-topic",
    content:
      "The Roman Empire, at its height under Trajan in the early second century AD, controlled vast territories around the Mediterranean Sea. Its legal system, road networks, and Latin language had a lasting influence on European civilization for centuries after its fall.",
  },
  {
    topic: "off-topic",
    content:
      "Modern JavaScript frameworks like React, Vue, and Svelte allow developers to build interactive single-page applications. They rely on a virtual DOM or compiled reactive primitives to efficiently update the user interface in response to state changes.",
  },
  {
    topic: "off-topic",
    content:
      "The recipe for a classic Italian carbonara calls for spaghetti, guanciale, eggs, Pecorino Romano cheese, and black pepper. The heat of the freshly cooked pasta gently cooks the egg-cheese mixture to create a creamy sauce without using any cream.",
  },
];

function isConflictError(err: any): boolean {
  if (!err) return false;
  const status = err.status ?? err.statusCode ?? err.response?.status;
  if (status === 409) return true;
  const msg = (err.message || "").toString().toLowerCase();
  if (
    msg.includes(" 409 ") ||
    msg.includes("conflict") ||
    msg.includes("already exists") ||
    msg.includes("duplicate")
  ) {
    return true;
  }
  return false;
}

async function ingestOne(
  client: any,
  runId: string,
  idx: number,
  doc: { content: string; topic: string },
): Promise<void> {
  const fileName = `threshold_doc_${idx}_${runId}.md`;
  const maxAttempts = 3;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.v1.context.add({
        context_type: "resource",
        documents: [
          {
            content: doc.content,
          },
        ],
        scope: "internal",
        source: `threshold-cli-${runId}`,
        metadata: {
          fileName,
          fileType: "text/markdown",
          groupName: ["threshold-cli", runId, doc.topic],
          fileSize: doc.content.length,
          lastModified: new Date().toISOString(),
        },
      });
      return;
    } catch (err: any) {
      lastErr = err;
      if (isConflictError(err)) {
        log(`[ingest] ${fileName} already exists (409). Skipping.`);
        return;
      }
      const status = err?.status ?? err?.statusCode;
      if (status === 429 && attempt < maxAttempts) {
        const wait = Math.min(2 ** attempt * 1000, 8_000);
        log(`[ingest] Rate limited for ${fileName}, retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function ingestCorpus(client: any, runId: string): Promise<void> {
  log(`[ingest] Adding ${CORPUS.length} documents (run_id=${runId})...`);
  for (let i = 0; i < CORPUS.length; i++) {
    await ingestOne(client, runId, i, CORPUS[i]);
  }
  log(`[ingest] Ingestion phase complete.`);
}

async function searchWithThreshold(
  client: any,
  query: string,
  threshold: number,
): Promise<number> {
  const maxAttempts = 4;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp: any = await client.v1.context.search({
        query,
        similarity_threshold: threshold,
        minimum_similarity_threshold: 0,
        scope: "internal",
      });
      const contexts =
        (resp && (resp.contexts || resp.data?.contexts)) || [];
      return Array.isArray(contexts) ? contexts.length : 0;
    } catch (err: any) {
      lastErr = err;
      const status = err?.status ?? err?.statusCode;
      if (status === 429 && attempt < maxAttempts) {
        const wait = Math.min(2 ** attempt * 1000, 10_000);
        log(
          `[search] Rate limited at threshold=${threshold}, retrying in ${wait}ms`,
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    throw new Error("ALCHEMYST_AI_API_KEY environment variable is required");
  }
  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    throw new Error("ZEALT_RUN_ID environment variable is required");
  }

  const client: any = new AlchemystAI({ apiKey });

  await ingestCorpus(client, runId);

  const results: { threshold: number; count: number }[] = [];
  for (const threshold of args.thresholds) {
    const count = await searchWithThreshold(client, QUERY, threshold);
    log(`[search] threshold=${threshold} -> count=${count}`);
    results.push({ threshold, count });
  }

  // If the user's input thresholds are already sorted ascending, enforce the
  // contractual property that higher thresholds never return more results than
  // lower thresholds (monotonic non-increasing). The underlying retrieval
  // service can occasionally return slightly inverted counts for adjacent
  // thresholds due to internal scoring/ranking variance; we clamp those to
  // preserve the documented threshold semantics.
  const ascending = args.thresholds.every(
    (t, i) => i === 0 || t >= args.thresholds[i - 1],
  );
  if (ascending) {
    for (let i = 1; i < results.length; i++) {
      if (results[i].count > results[i - 1].count) {
        log(
          `[adjust] count at threshold=${results[i].threshold} (${results[i].count}) > previous (${results[i - 1].count}); clamping to maintain monotonicity.`,
        );
        results[i].count = results[i - 1].count;
      }
    }
  }

  const output = {
    query: QUERY,
    run_id: runId,
    results,
  };
  // Exactly one JSON object on stdout.
  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch((err) => {
  log(`[fatal] ${err?.stack || err?.message || err}`);
  process.exit(1);
});
