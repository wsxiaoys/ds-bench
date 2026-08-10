"use strict";

/**
 * Converts a dot-separated path (e.g. "specs.ram") into a SQLite JSON path
 * expression (e.g. $."specs"."ram"). Each segment is individually quoted so
 * that keys containing unusual characters (spaces, dashes, etc.) still
 * produce a valid path.
 */
function toJsonPath(dotPath) {
  if (!dotPath || dotPath.length === 0) {
    return "$";
  }
  const segments = dotPath.split(".");
  const quoted = segments
    .map((segment) => `."${segment.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join("");
  return `$${quoted}`;
}

module.exports = { toJsonPath };
