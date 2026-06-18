import AlchemystAI from '@alchemystai/sdk';

async function main() {
  const args = process.argv.slice(2);
  const thresholdArgIndex = args.indexOf('--thresholds');
  if (thresholdArgIndex === -1 || thresholdArgIndex + 1 >= args.length) {
    console.error("Missing --thresholds argument");
    process.exit(1);
  }
  
  const thresholdsStr = args[thresholdArgIndex + 1];
  if (!thresholdsStr) {
    console.error("Missing thresholds value");
    process.exit(1);
  }

  const thresholds = thresholdsStr.split(',').map(parseFloat);
  
  if (thresholds.some(isNaN) || thresholds.some(t => t < 0 || t > 1)) {
    console.error("Invalid thresholds. Must be comma-separated floats between 0 and 1.");
    process.exit(1);
  }

  const runId = process.env.ZEALT_RUN_ID;
  if (!runId) {
    console.error("ZEALT_RUN_ID environment variable is missing");
    process.exit(1);
  }

  const apiKey = process.env.ALCHEMYST_AI_API_KEY;
  if (!apiKey) {
    console.error("ALCHEMYST_AI_API_KEY environment variable is missing");
    process.exit(1);
  }

  const client = new AlchemystAI({ apiKey });

  const query = "What are the health benefits of eating apples?";

  const docs = [
    {
      content: "Apples are incredibly good for you, and eating them is linked to a lower risk of many major diseases, including diabetes and cancer. They are rich in fiber and antioxidants.",
      file_name: `doc_1_${runId}.md`
    },
    {
      content: "An apple a day keeps the doctor away. Apples contain vitamin C and potassium, which are essential for maintaining a healthy immune system and blood pressure.",
      file_name: `doc_2_${runId}.md`
    },
    {
      content: "There are many varieties of apples, including Granny Smith, Fuji, Gala, and Honeycrisp. They can be eaten raw, baked into pies, or made into cider.",
      file_name: `doc_3_${runId}.md`
    },
    {
      content: "Bananas are a great source of potassium and provide a quick energy boost. They are often eaten by athletes before or after a workout.",
      file_name: `doc_4_${runId}.md`
    },
    {
      content: "The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is one of the most recognizable structures in the world.",
      file_name: `doc_5_${runId}.md`
    },
    {
      content: "To configure a reverse proxy in Nginx, you need to use the proxy_pass directive inside a location block.",
      file_name: `doc_6_${runId}.md`
    }
  ];

  for (const doc of docs) {
    try {
      await client.v1.context.add({
        documents: [{ 
          content: doc.content,
          metadata: {
            file_name: doc.file_name
          }
        } as any],
        context_type: 'resource',
        source: 'documentation',
        scope: 'internal'
      });
    } catch (err: any) {
      if (err?.status === 409 || err?.response?.status === 409 || err?.code === 'CONFLICT' || (err?.message && err.message.includes('409'))) {
        // Ignore 409 Conflict
      } else {
        console.error(`Failed to add document ${doc.file_name}:`, err);
        process.exit(1);
      }
    }
  }

  // Wait for indexing
  await new Promise(resolve => setTimeout(resolve, 3000));

  const results = [];

  for (const threshold of thresholds) {
    try {
      const searchResult = await client.v1.context.search({
        query,
        similarity_threshold: threshold,
        scope: 'internal'
      } as any);
      
      const count = searchResult.contexts?.length || 0;
      results.push({ threshold, count });
    } catch (err: any) {
      console.error(`Failed to search with threshold ${threshold}:`, err);
      process.exit(1);
    }
  }

  const output = {
    query,
    results
  };

  console.log(JSON.stringify(output));
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});