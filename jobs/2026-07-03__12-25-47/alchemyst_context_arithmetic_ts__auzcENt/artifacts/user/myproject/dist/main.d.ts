#!/usr/bin/env node
/**
 * Alchemyst Context Arithmetic Intersection Search CLI
 *
 * Demonstrates the parameter casing difference between writing and reading
 * group metadata in @alchemystai/sdk:
 *  - v1.context.add  -> metadata.group_name (snake_case) when ingesting
 *  - v1.context.search -> metadata.groupName (camelCase) when filtering
 *
 * Usage:
 *   node dist/main.js --groups eng v1
 *
 * Outputs a single JSON array on stdout containing the deduplicated matched
 * documents (each with at least a `key` field).
 */
export {};
