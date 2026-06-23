import { LlamaCloud } from "@llamaindex/llama-cloud";
import pLimit from "p-limit";
import fs from "fs";
import path from "path";

const ZEALT_RUN_ID = process.env.ZEALT_RUN_ID;
const API_KEY = process.env.LLAMA_CLOUD_API_KEY;

if (!ZEALT_RUN_ID) {
  console.error("ZEALT_RUN_ID is not set");
  process.exit(1);
}

const client = new LlamaCloud({
  apiKey: API_KEY,
});

const inputDir = "./inputs";
const outputDir = "./outputs";
const logFile = "./output.log";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function processFile(fileName: string) {
  const filePath = path.join(inputDir, fileName);
  const baseName = path.basename(fileName, ".pdf");
  const external_file_id = `${ZEALT_RUN_ID}-${baseName}`;

  try {
    let fileId: string;
    try {
      // Upload file
      const file = await client.files.create({
        file: fs.createReadStream(filePath),
        purpose: "parse",
        external_file_id,
      });
      fileId = file.id;
    } catch (error: any) {
      // If file already exists, find it
      if (error.status === 400) {
        const existingFiles = await client.files.list({ external_file_id });
        if (existingFiles.items && existingFiles.items.length > 0) {
          fileId = existingFiles.items[0].id;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Parse file
    const result = await client.parsing.parse({
      file_id: fileId,
      tier: "cost_effective",
      version: "latest",
      expand: ["markdown"],
    });

    const pages = result.markdown?.pages || [];
    const markdownContent = pages
      .map((page: any) => {
        if (page.success) {
          return page.markdown;
        }
        return `Error parsing page ${page.page_number}: ${page.error}`;
      })
      .join("\n\n---\n\n");

    const outputPath = path.join(outputDir, `${baseName}.md`);
    fs.writeFileSync(outputPath, markdownContent);

    const pageCount = pages.length;
    const logLine = `Parsed: ${fileName} | pages: ${pageCount}`;
    console.log(logLine);
    return logLine;
  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
    throw error;
  }
}

async function main() {
  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".pdf"));
  const limit = pLimit(2);

  const tasks = files.map((file) => limit(() => processFile(file)));
  const results = await Promise.all(tasks);

  fs.writeFileSync(logFile, results.join("\n") + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
