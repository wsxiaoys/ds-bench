"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const gel_1 = require("gel");
function validateRecord(record) {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
        return false;
    }
    if (!('sku' in record) || !('name' in record) || !('price_cents' in record) || !('stock' in record) || !('category' in record)) {
        return false;
    }
    if (typeof record.sku !== 'string' || record.sku === '') {
        return false;
    }
    if (typeof record.name !== 'string' || record.name === '') {
        return false;
    }
    if (typeof record.category !== 'string' || record.category === '') {
        return false;
    }
    if (typeof record.price_cents !== 'number' || !Number.isInteger(record.price_cents) || record.price_cents < 0) {
        return false;
    }
    if (typeof record.stock !== 'number' || !Number.isInteger(record.stock) || record.stock < 0) {
        return false;
    }
    if ('tags' in record) {
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
function cleanTags(tags) {
    if (!tags || !Array.isArray(tags))
        return [];
    const uniqueTags = Array.from(new Set(tags));
    return uniqueTags.sort();
}
async function main() {
    let inputPath = null;
    for (let i = 2; i < process.argv.length; i++) {
        if (process.argv[i] === '--input') {
            inputPath = process.argv[i + 1] || null;
            break;
        }
    }
    if (!inputPath) {
        console.log(JSON.stringify({
            ok: false,
            error_code: "input_unreadable",
            message: "No input path provided via --input"
        }));
        process.exit(2);
    }
    let fileContent;
    try {
        fileContent = fs.readFileSync(inputPath, 'utf8');
    }
    catch (err) {
        console.log(JSON.stringify({
            ok: false,
            error_code: "input_unreadable",
            message: `Failed to read input file: ${err.message}`
        }));
        process.exit(2);
    }
    let batch;
    try {
        batch = JSON.parse(fileContent);
    }
    catch (err) {
        console.log(JSON.stringify({
            ok: false,
            error_code: "input_unreadable",
            message: `Invalid JSON: ${err.message}`
        }));
        process.exit(2);
    }
    if (!Array.isArray(batch)) {
        console.log(JSON.stringify({
            ok: false,
            error_code: "invalid_record",
            message: "Top-level JSON value is not an array",
            index: null
        }));
        process.exit(3);
    }
    for (let i = 0; i < batch.length; i++) {
        const record = batch[i];
        if (!validateRecord(record)) {
            console.log(JSON.stringify({
                ok: false,
                error_code: "invalid_record",
                message: `Record at index ${i} is invalid`,
                index: i
            }));
            process.exit(3);
        }
    }
    const skusSeen = new Set();
    for (const record of batch) {
        if (skusSeen.has(record.sku)) {
            console.log(JSON.stringify({
                ok: false,
                error_code: "duplicate_sku",
                message: `Duplicate SKU found: ${record.sku}`,
                sku: record.sku
            }));
            process.exit(4);
        }
        skusSeen.add(record.sku);
    }
    if (batch.length === 0) {
        console.log(JSON.stringify({
            ok: true,
            total: 0,
            inserted: 0,
            updated: 0,
            unchanged: 0,
            results: []
        }));
        process.exit(0);
    }
    const client = (0, gel_1.createClient)();
    try {
        const result = await client.transaction(async (tx) => {
            // 1. Ensure all categories exist
            const categoriesSet = new Set();
            const tagsSet = new Set();
            const skus = [];
            for (const record of batch) {
                categoriesSet.add(record.category);
                const recordTags = cleanTags(record.tags);
                for (const tag of recordTags) {
                    tagsSet.add(tag);
                }
                skus.push(record.sku);
            }
            const categories = Array.from(categoriesSet);
            const tags = Array.from(tagsSet);
            if (categories.length > 0) {
                await tx.query(`
          for cat_name in array_unpack(<array<str>>$categories) union (
            insert Category { name := cat_name }
            unless conflict on .name
            else (select Category)
          )
        `, { categories });
            }
            if (tags.length > 0) {
                await tx.query(`
          for tag_label in array_unpack(<array<str>>$tags) union (
            insert Tag { label := tag_label }
            unless conflict on .label
            else (select Tag)
          )
        `, { tags });
            }
            // 2. Fetch existing products for comparison
            const existingProducts = await tx.query(`
        select Product {
          sku,
          name,
          price_cents,
          stock,
          category_name := .category.name,
          tag_labels := (select .tags.label)
        } filter .sku in array_unpack(<array<str>>$skus);
      `, { skus });
            const existingMap = new Map();
            for (const p of existingProducts) {
                existingMap.set(p.sku, p);
            }
            // 3. Classify outcome for each record
            let insertedCount = 0;
            let updatedCount = 0;
            let unchangedCount = 0;
            const results = [];
            const productsParam = [];
            for (const record of batch) {
                const existing = existingMap.get(record.sku);
                const recordTags = cleanTags(record.tags);
                let outcome;
                if (!existing) {
                    outcome = 'inserted';
                    insertedCount++;
                }
                else {
                    const existingTags = (existing.tag_labels || []).sort();
                    const tagsMatch = recordTags.length === existingTags.length &&
                        recordTags.every((val, index) => val === existingTags[index]);
                    const match = record.name === existing.name &&
                        record.price_cents === existing.price_cents &&
                        record.stock === existing.stock &&
                        record.category === existing.category_name &&
                        tagsMatch;
                    if (match) {
                        outcome = 'unchanged';
                        unchangedCount++;
                    }
                    else {
                        outcome = 'updated';
                        updatedCount++;
                    }
                }
                results.push({
                    sku: record.sku,
                    outcome,
                    category: record.category,
                    tags: recordTags
                });
                productsParam.push({
                    sku: record.sku,
                    name: record.name,
                    price_cents: record.price_cents,
                    stock: record.stock,
                    category: record.category,
                    tags: recordTags
                });
            }
            results.sort((a, b) => a.sku.localeCompare(b.sku));
            // 4. Perform bulk insert/update of products
            if (productsParam.length > 0) {
                await tx.query(`
          with
            products_json := <json>$products
          for item in json_array_unpack(products_json) union (
            insert Product {
              sku := <str>item['sku'],
              name := <str>item['name'],
              price_cents := <int64>item['price_cents'],
              stock := <int64>item['stock'],
              category := (select Category filter .name = <str>item['category']),
              tags := (select Tag filter .label in array_unpack(<array<str>>item['tags']))
            }
            unless conflict on .sku
            else (
              update Product
              set {
                name := <str>item['name'],
                price_cents := <int64>item['price_cents'],
                stock := <int64>item['stock'],
                category := (select Category filter .name = <str>item['category']),
                tags := (select Tag filter .label in array_unpack(<array<str>>item['tags']))
              }
            )
          )
        `, { products: productsParam });
            }
            return {
                ok: true,
                total: batch.length,
                inserted: insertedCount,
                updated: updatedCount,
                unchanged: unchangedCount,
                results
            };
        });
        console.log(JSON.stringify(result));
        process.exit(0);
    }
    catch (dbError) {
        console.log(JSON.stringify({
            ok: false,
            error_code: "db_error",
            message: `Database error: ${dbError.message || dbError}`
        }));
        process.exit(5);
    }
    finally {
        await client.close();
    }
}
main();
