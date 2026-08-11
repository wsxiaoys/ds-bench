import * as fs from 'fs';
import { createClient } from 'gel';

function fail(code: number, errorCode: string, message: string, extra: Record<string, any> = {}): never {
  console.log(JSON.stringify({
    ok: false,
    error_code: errorCode,
    message,
    ...extra
  }));
  process.exit(code);
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') {
      if (i + 1 < args.length) {
        inputPath = args[i + 1];
      }
      break;
    }
  }

  if (inputPath === null) {
    fail(2, "input_unreadable", "No --input argument was given");
  }

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(inputPath, 'utf8');
  } catch (err: any) {
    fail(2, "input_unreadable", `Failed to read file: ${err.message || String(err)}`);
  }

  let batch: any;
  try {
    batch = JSON.parse(fileContent);
  } catch (err: any) {
    fail(2, "input_unreadable", `Failed to parse JSON: ${err.message || String(err)}`);
  }

  if (!Array.isArray(batch)) {
    fail(3, "invalid_record", "The top-level JSON value is not an array", { index: null });
  }

  for (let i = 0; i < batch.length; i++) {
    const record = batch[i];
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      fail(3, "invalid_record", `Record at index ${i} is not an object`, { index: i });
    }
    if (typeof record.sku !== 'string' || record.sku.length === 0) {
      fail(3, "invalid_record", `Record at index ${i} has missing or empty 'sku'`, { index: i });
    }
    if (typeof record.name !== 'string' || record.name.length === 0) {
      fail(3, "invalid_record", `Record at index ${i} has missing or empty 'name'`, { index: i });
    }
    if (typeof record.price_cents !== 'number' || !Number.isInteger(record.price_cents) || record.price_cents < 0) {
      fail(3, "invalid_record", `Record at index ${i} has invalid 'price_cents'`, { index: i });
    }
    if (typeof record.stock !== 'number' || !Number.isInteger(record.stock) || record.stock < 0) {
      fail(3, "invalid_record", `Record at index ${i} has invalid 'stock'`, { index: i });
    }
    if (typeof record.category !== 'string' || record.category.length === 0) {
      fail(3, "invalid_record", `Record at index ${i} has missing or empty 'category'`, { index: i });
    }
    if (record.tags !== undefined) {
      if (!Array.isArray(record.tags)) {
        fail(3, "invalid_record", `Record at index ${i} has non-array 'tags'`, { index: i });
      }
      for (let j = 0; j < record.tags.length; j++) {
        const tag = record.tags[j];
        if (typeof tag !== 'string' || tag.length === 0) {
          fail(3, "invalid_record", `Record at index ${i} has invalid tag at index ${j}`, { index: i });
        }
      }
    }
  }

  const seenSkus = new Set<string>();
  for (const record of batch) {
    if (seenSkus.has(record.sku)) {
      fail(4, "duplicate_sku", `Duplicate sku: ${record.sku}`, { sku: record.sku });
    }
    seenSkus.add(record.sku);
  }

  const normalizedRecords = batch.map((r: any) => {
    const uniqueTags = Array.from(new Set<string>(r.tags || []));
    uniqueTags.sort();
    return {
      sku: r.sku as string,
      name: r.name as string,
      price_cents: r.price_cents as number,
      stock: r.stock as number,
      category: r.category as string,
      tags: uniqueTags
    };
  });

  const client = createClient();

  const results: { sku: string; outcome: 'inserted' | 'updated' | 'unchanged'; category: string; tags: string[] }[] = [];
  const toUpsert: any[] = [];

  try {
    await client.transaction(async (tx) => {
      // 1. Ensure categories exist
      const allCategories = Array.from(new Set<string>(normalizedRecords.map((r) => r.category)));
      if (allCategories.length > 0) {
        await tx.execute(`
          for cat_name in array_unpack(<array<str>>$categories) union (
            insert Category { name := cat_name }
            unless conflict on .name
            else Category
          )
        `, { categories: allCategories });
      }

      // 2. Ensure tags exist
      const allTags = Array.from(new Set<string>(normalizedRecords.flatMap((r) => r.tags)));
      if (allTags.length > 0) {
        await tx.execute(`
          for tag_label in array_unpack(<array<str>>$tags) union (
            insert Tag { label := tag_label }
            unless conflict on .label
            else Tag
          )
        `, { tags: allTags });
      }

      // 3. Fetch existing products matching the SKUs in the batch
      const skus = normalizedRecords.map((r) => r.sku);
      const existingProducts = await tx.query<any>(`
        select Product {
          sku,
          name,
          price_cents,
          stock,
          category: { name },
          tags: { label }
        } filter .sku in array_unpack(<array<str>>$skus)
      `, { skus });

      const existingMap = new Map<string, any>();
      for (const p of existingProducts) {
        existingMap.set(p.sku, p);
      }

      // Reset the arrays inside transaction retry block to avoid duplication/accumulation on retry
      results.length = 0;
      toUpsert.length = 0;

      for (const record of normalizedRecords) {
        const existing = existingMap.get(record.sku);
        let outcome: 'inserted' | 'updated' | 'unchanged';
        if (!existing) {
          outcome = 'inserted';
          toUpsert.push(record);
        } else {
          const nameDiff = existing.name !== record.name;
          const priceDiff = existing.price_cents !== record.price_cents;
          const stockDiff = existing.stock !== record.stock;
          const categoryDiff = existing.category?.name !== record.category;

          const existingTags = (existing.tags || []).map((t: any) => t.label);
          existingTags.sort();

          let tagsDiff = existingTags.length !== record.tags.length;
          if (!tagsDiff) {
            for (let i = 0; i < existingTags.length; i++) {
              if (existingTags[i] !== record.tags[i]) {
                tagsDiff = true;
                break;
              }
            }
          }

          if (nameDiff || priceDiff || stockDiff || categoryDiff || tagsDiff) {
            outcome = 'updated';
            toUpsert.push(record);
          } else {
            outcome = 'unchanged';
          }
        }

        results.push({
          sku: record.sku,
          outcome,
          category: record.category,
          tags: record.tags
        });
      }

      // 4. Perform upsert if needed
      if (toUpsert.length > 0) {
        await tx.execute(`
          with
            batch_json := to_json(<str>$batch_json)
          for r in json_array_unpack(batch_json) union (
            insert Product {
              sku := <str>r['sku'],
              name := <str>r['name'],
              price_cents := <int64>r['price_cents'],
              stock := <int64>r['stock'],
              category := (select Category filter .name = <str>r['category']),
              tags := (select Tag filter .label in array_unpack(<array<str>>r['tags']))
            }
            unless conflict on .sku
            else (
              update Product set {
                name := <str>r['name'],
                price_cents := <int64>r['price_cents'],
                stock := <int64>r['stock'],
                category := (select Category filter .name = <str>r['category']),
                tags := (select Tag filter .label in array_unpack(<array<str>>r['tags']))
              }
            )
          )
        `, { batch_json: JSON.stringify(toUpsert) });
      }
    });
  } catch (err: any) {
    fail(5, "db_error", err.message || String(err));
  } finally {
    await client.close();
  }

  results.sort((a, b) => a.sku.localeCompare(b.sku));

  const total = results.length;
  const inserted = results.filter((r) => r.outcome === 'inserted').length;
  const updated = results.filter((r) => r.outcome === 'updated').length;
  const unchanged = results.filter((r) => r.outcome === 'unchanged').length;

  console.log(JSON.stringify({
    ok: true,
    total,
    inserted,
    updated,
    unchanged,
    results
  }));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
