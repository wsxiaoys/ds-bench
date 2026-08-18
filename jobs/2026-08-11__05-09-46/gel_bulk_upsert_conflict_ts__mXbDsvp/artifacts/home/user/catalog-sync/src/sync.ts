import * as fs from 'fs';
import { createClient } from 'gel';

// Define the record interface
interface CatalogRecord {
  sku: string;
  name: string;
  price_cents: number;
  stock: number;
  category: string;
  tags?: string[];
}

function exitError(code: number, errorCode: string, message: string, extra: Record<string, any> = {}) {
  const response = {
    ok: false,
    error_code: errorCode,
    message,
    ...extra
  };
  console.log(JSON.stringify(response));
  process.exit(code);
}

function isValidRecord(record: any): boolean {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return false;
  }
  if (typeof record.sku !== 'string' || record.sku === '') {
    return false;
  }
  if (typeof record.name !== 'string' || record.name === '') {
    return false;
  }
  if (typeof record.price_cents !== 'number' || !Number.isInteger(record.price_cents) || record.price_cents < 0) {
    return false;
  }
  if (typeof record.stock !== 'number' || !Number.isInteger(record.stock) || record.stock < 0) {
    return false;
  }
  if (typeof record.category !== 'string' || record.category === '') {
    return false;
  }
  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags)) {
      return false;
    }
    for (const tag of record.tags) {
      if (typeof tag !== 'string' || tag === '') {
        return false;
      }
    }
  }
  return true;
}

async function main() {
  // 1. Parse command line arguments
  let inputPath: string | null = null;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--input') {
      if (i + 1 < process.argv.length) {
        inputPath = process.argv[i + 1];
        i++;
      }
    }
  }

  if (!inputPath) {
    exitError(2, 'input_unreadable', 'No --input argument was given');
    return;
  }

  // 2. Read file content
  let fileContent: string;
  try {
    fileContent = fs.readFileSync(inputPath, 'utf8');
  } catch (err: any) {
    exitError(2, 'input_unreadable', `Failed to read file: ${err.message}`);
    return;
  }

  // 3. Parse JSON
  let batch: any;
  try {
    batch = JSON.parse(fileContent);
  } catch (err: any) {
    exitError(2, 'input_unreadable', `Invalid JSON content: ${err.message}`);
    return;
  }

  // 4. Validate top-level value
  if (!Array.isArray(batch)) {
    exitError(3, 'invalid_record', 'Top-level JSON value is not an array', { index: null });
    return;
  }

  // 5. Validate every record format
  for (let i = 0; i < batch.length; i++) {
    if (!isValidRecord(batch[i])) {
      exitError(3, 'invalid_record', `Record at index ${i} violates the batch format`, { index: i });
      return;
    }
  }

  // 6. Check for duplicate SKUs
  const seenSkus = new Set<string>();
  for (const record of batch) {
    if (seenSkus.has(record.sku)) {
      exitError(4, 'duplicate_sku', `Duplicate SKU detected: ${record.sku}`, { sku: record.sku });
      return;
    }
    seenSkus.add(record.sku);
  }

  // 7. Run database transaction
  const client = createClient();
  let queryResults: any[] = [];

  try {
    await client.transaction(async (tx) => {
      // Step 1: Ensure all categories and tags exist
      await tx.query(`
        with
          batch_json := <json>$batch,
          records := json_array_unpack(batch_json),
          categories_to_insert := (
            select distinct <str>json_get(records, 'category')
          ),
          tags_to_insert := (
            select distinct <str>json_array_unpack(json_get(records, 'tags'))
          )
        select {
          inserted_categories := (
            for cat_name in categories_to_insert
            union (
              insert Category { name := cat_name }
              unless conflict on .name
              else Category
            )
          ),
          inserted_tags := (
            for tag_label in tags_to_insert
            union (
              insert Tag { label := tag_label }
              unless conflict on .label
              else Tag
            )
          )
        }
      `, { batch });

      // Step 2: Insert/Update Products and get outcome per record
      queryResults = await tx.query(`
        with
          batch_json := <json>$batch,
          records := json_array_unpack(batch_json)
        for record in records union (
          with
            sku := <str>json_get(record, 'sku'),
            name := <str>json_get(record, 'name'),
            price_cents := <int64>json_get(record, 'price_cents'),
            stock := <int64>json_get(record, 'stock'),
            cat_name := <str>json_get(record, 'category'),
            tag_labels := (select distinct <str>json_array_unpack(json_get(record, 'tags'))),
            existing := (select Product filter .sku = sku),
            ex_tags := (select existing.tags.label),
            tags_changed := (
              count(tag_labels except ex_tags) > 0 or count(ex_tags except tag_labels) > 0
            ),
            changed := (
              not exists existing or
              (existing.name ?? '') != name or
              (existing.price_cents ?? -1) != price_cents or
              (existing.stock ?? -1) != stock or
              (existing.category.name ?? '') != cat_name or
              tags_changed
            ),
            resolved_category := (select Category filter .name = cat_name limit 1),
            resolved_tags := (select Tag filter .label in tag_labels),
            upserted := (
              if not exists existing then (
                insert Product {
                  sku := sku,
                  name := name,
                  price_cents := price_cents,
                  stock := stock,
                  category := resolved_category,
                  tags := resolved_tags
                }
              ) else (
                if changed then (
                  update existing set {
                    name := name,
                    price_cents := price_cents,
                    stock := stock,
                    category := resolved_category,
                    tags := resolved_tags
                  }
                ) else (
                  existing
                )
              )
            )
          select {
            sku := sku,
            outcome := (
              if not exists existing then 'inserted'
              else if changed then 'updated'
              else 'unchanged'
            ),
            id := upserted.id
          }
        )
      `, { batch });
    });
  } catch (err: any) {
    exitError(5, 'db_error', `Database transaction rejected: ${err.message}`);
    return;
  } finally {
    await client.close();
  }

  // 8. Build success output
  const outcomeBySku = new Map<string, string>();
  for (const res of queryResults) {
    outcomeBySku.set(res.sku, res.outcome);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  const resultsList = batch.map((record: CatalogRecord) => {
    const outcome = outcomeBySku.get(record.sku) || 'unchanged';
    if (outcome === 'inserted') insertedCount++;
    else if (outcome === 'updated') updatedCount++;
    else if (outcome === 'unchanged') unchangedCount++;

    const deDupedTags = record.tags ? Array.from(new Set(record.tags)).sort() : [];

    return {
      sku: record.sku,
      outcome,
      category: record.category,
      tags: deDupedTags
    };
  });

  // Sort results by sku in ascending lexicographic order
  resultsList.sort((a: any, b: any) => a.sku.localeCompare(b.sku));

  const successResponse = {
    ok: true,
    total: batch.length,
    inserted: insertedCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    results: resultsList
  };

  console.log(JSON.stringify(successResponse));
  process.exit(0);
}

main();
