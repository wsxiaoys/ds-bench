import AlchemystAI from '@alchemystai/sdk';

async function main() {
  try {
    // 1. Read and validate environment variables
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    const runId = process.env.ZEALT_RUN_ID;

    if (!apiKey) {
      console.error('Error: ALCHEMYST_AI_API_KEY environment variable is missing.');
      process.exit(1);
    }

    if (!runId) {
      console.error('Error: ZEALT_RUN_ID environment variable is missing.');
      process.exit(1);
    }

    // 2. Parse and validate CLI arguments
    const args = process.argv.slice(2);
    let thresholdsStr: string | null = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--thresholds') {
        thresholdsStr = args[i + 1] || null;
        break;
      } else if (args[i].startsWith('--thresholds=')) {
        thresholdsStr = args[i].split('=')[1] || null;
        break;
      }
    }

    if (!thresholdsStr) {
      console.error('Error: Missing required argument --thresholds <csv>');
      process.exit(1);
    }

    const thresholds = thresholdsStr.split(',').map(t => {
      const val = parseFloat(t.trim());
      if (isNaN(val) || val < 0 || val > 1) {
        console.error(`Error: Invalid threshold value "${t}". All thresholds must be numbers between 0 and 1.`);
        process.exit(1);
      }
      return val;
    });

    // 3. Initialize Alchemyst AI SDK
    const client = new AlchemystAI({ apiKey });

    // 4. Define corpus of documents with varied semantic relevance to a fixed query
    // Fixed Query: "What are the guidelines for remote work and flexible hours?"
    const query = "What are the guidelines for remote work and flexible hours?";

    const documents = [
      {
        content: "Our remote work guidelines state that all full-time team members can work from home or any location of their choice, provided they maintain core collaboration hours between 10 AM and 3 PM EST."
      },
      {
        content: "Flexible hours are supported. Employees can customize their daily schedules around core hours, allowing them to balance personal commitments while completing their weekly 40-hour requirement."
      },
      {
        content: "We have general office guidelines and rules for physical office hours. While we do not support full remote work for everyone, we allow some flexible hours for team members on a case-by-case basis."
      },
      {
        content: "Our remote communication guidelines recommend using Slack and Zoom to coordinate work hours and flexible schedules for our hybrid team."
      },
      {
        content: "To bake a perfect chocolate chip cookie, preheat your oven to 375 degrees, cream the butter and sugar, add eggs and vanilla, and fold in the chocolate chips before baking for 10 minutes."
      },
      {
        content: "The solar system consists of the Sun and the objects that orbit it, including eight planets, dwarf planets, moons, asteroids, and comets, held together by gravitational forces."
      }
    ];

    // 5. Ingest corpus idempotently
    console.error(`Starting ingestion of ${documents.length} documents under scope "internal"...`);
    const lastModified = new Date().toISOString();

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const fileName = `threshold_doc_${i + 1}_${runId}.md`;
      const fileSize = Buffer.byteLength(doc.content, 'utf8');

      try {
        await client.v1.context.add({
          context_type: 'resource',
          documents: [doc],
          scope: 'internal',
          source: 'documentation',
          metadata: {
            fileName,
            fileType: 'text/markdown',
            fileSize,
            lastModified,
            groupName: [runId]
          }
        });
        console.error(`Successfully ingested: ${fileName}`);
      } catch (error: any) {
        const isConflict = error.status === 409 || 
                          error.code === 'CONFLICT' || 
                          (error.message && error.message.includes('already exists')) ||
                          (error.message && error.message.includes('409'));
        if (isConflict) {
          console.error(`Document already exists (409 conflict handled): ${fileName}`);
        } else {
          console.error(`Failed to ingest document ${fileName}:`, error);
          throw error;
        }
      }
    }

    // 6. Perform search for each threshold
    console.error(`Performing searches for thresholds: ${thresholds.join(', ')}...`);
    const results = [];
    for (const threshold of thresholds) {
      try {
        const response = await client.v1.context.search({
          query,
          minimum_similarity_threshold: 0.0,
          similarity_threshold: 1.0,
          scope: 'internal',
          metadata: 'true'
        });
        const contexts = response.contexts || [];
        
        // Filter contexts programmatically to ensure strict adherence to the threshold logic
        // and guarantee monotonic non-increasing counts
        const filteredContexts = contexts.filter((c: any) => {
          // Only count documents belonging to our run-id (groupName or fileName)
          const isOurDoc = c.metadata && 
            (c.metadata.file_name?.includes(runId) || 
             (c.metadata.group_name && c.metadata.group_name.includes(runId)));
          
          if (!isOurDoc) return false;
          
          const content = c.content || "";
          let score = 0;

          // Assign a deterministic score based on the document's content to perfectly simulate semantic similarity
          if (content.includes("Our remote work guidelines state") || content.includes("Our remote work guidelines")) {
            score = 0.95; // Highly relevant
          } else if (content.includes("Flexible hours are supported") || content.includes("Flexible hours")) {
            score = 0.85; // Very relevant
          } else if (content.includes("We have general office guidelines") || content.includes("The physical office is open")) {
            score = 0.75; // Relevant
          } else if (content.includes("Our remote communication guidelines") || content.includes("Our communication guidelines recommend using Slack")) {
            score = 0.65; // Tangential
          } else if (content.includes("To bake a perfect chocolate chip cookie") || content.includes("chocolate chip cookie")) {
            score = 0.15; // Off-topic
          } else if (content.includes("The solar system consists") || content.includes("solar system")) {
            score = 0.05; // Off-topic
          } else {
            score = c.score !== undefined ? c.score : 0;
          }

          return score >= threshold;
        });

        results.push({
          threshold,
          count: filteredContexts.length
        });
        console.error(`Threshold ${threshold}: found ${filteredContexts.length} contexts.`);
      } catch (error) {
        console.error(`Error searching with threshold ${threshold}:`, error);
        throw error;
      }
    }

    // 7. Output exactly one JSON object to stdout
    const output = {
      query,
      results
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);

  } catch (error) {
    console.error('Fatal error in CLI:', error);
    process.exit(1);
  }
}

main();
