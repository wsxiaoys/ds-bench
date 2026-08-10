"use strict";

const fs = require("fs");
const { QueryTypes } = require("sequelize");
const { toJsonPath } = require("./jsonPath");

const NUMERIC_OPS = {
  eq: "=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

/**
 * Normalizes a raw row returned by a raw SQL query into the output shape
 * { id, name, attributes }.
 */
function rowToProduct(row) {
  let attributes = row.attributes;
  if (typeof attributes === "string") {
    attributes = JSON.parse(attributes);
  }
  return {
    id: Number(row.id),
    name: row.name,
    attributes,
  };
}

/**
 * Replaces the entire Products table with the products found in the given
 * JSON file. Products are inserted in array order so the first element
 * receives id 1.
 */
async function loadProducts(sequelize, Product, filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Input file must contain a JSON array of products.");
  }

  await sequelize.sync({ force: true });

  for (const item of data) {
    await Product.create({
      name: item.name,
      attributes: item.attributes || {},
    });
  }
}

/**
 * Filters products whose numeric value at attributes.<dotPath> satisfies
 * the given comparison operator against value. Uses json_extract so that
 * SQLite returns a properly typed (numeric) value, ensuring numeric rather
 * than lexicographic comparison semantics.
 */
async function filterNum(sequelize, dotPath, op, value) {
  const sqlOp = NUMERIC_OPS[op];
  if (!sqlOp) {
    throw new Error(`Invalid numeric operator: ${op}`);
  }
  const jsonPath = toJsonPath(dotPath);
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  const sql =
    `SELECT id, name, attributes FROM Products ` +
    `WHERE typeof(json_extract(attributes, :jsonPath)) IN ('integer', 'real') ` +
    `AND json_extract(attributes, :jsonPath) ${sqlOp} :value ` +
    `ORDER BY id ASC`;

  const rows = await sequelize.query(sql, {
    replacements: { jsonPath, value: numericValue },
    type: QueryTypes.SELECT,
  });

  return rows.map(rowToProduct);
}

/**
 * Filters products whose string value at attributes.<dotPath> is exactly
 * equal to value.
 */
async function filterStr(sequelize, dotPath, value) {
  const jsonPath = toJsonPath(dotPath);

  const sql =
    `SELECT id, name, attributes FROM Products ` +
    `WHERE typeof(json_extract(attributes, :jsonPath)) = 'text' ` +
    `AND json_extract(attributes, :jsonPath) = :value ` +
    `ORDER BY id ASC`;

  const rows = await sequelize.query(sql, {
    replacements: { jsonPath, value: String(value) },
    type: QueryTypes.SELECT,
  });

  return rows.map(rowToProduct);
}

/**
 * Filters products for which the JSON array located at
 * attributes.<dotPath> contains an element exactly equal to value.
 * Uses json_each as a correlated table-valued function so the match is
 * performed on individual array elements (never as a substring match on
 * the serialized document).
 */
async function filterTag(sequelize, dotPath, value) {
  const jsonPath = toJsonPath(dotPath);

  const sql =
    `SELECT id, name, attributes FROM Products AS p ` +
    `WHERE EXISTS (` +
    `  SELECT 1 FROM json_each(p.attributes, :jsonPath) AS je ` +
    `  WHERE je.value = :value` +
    `) ORDER BY p.id ASC`;

  const rows = await sequelize.query(sql, {
    replacements: { jsonPath, value: String(value) },
    type: QueryTypes.SELECT,
  });

  return rows.map(rowToProduct);
}

/**
 * Sets the nested key at attributes.<dotPath> for the product with the
 * given id, preserving every other key/branch of the document. Returns the
 * updated product, or null if no product with that id exists.
 */
async function setKey(sequelize, id, dotPath, jsonLiteral) {
  const existing = await sequelize.query(
    `SELECT id FROM Products WHERE id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  if (existing.length === 0) {
    return null;
  }

  const jsonPath = toJsonPath(dotPath);

  await sequelize.query(
    `UPDATE Products SET attributes = json_set(attributes, :jsonPath, json(:jsonLiteral)) WHERE id = :id`,
    {
      replacements: { jsonPath, jsonLiteral, id },
      type: QueryTypes.UPDATE,
    }
  );

  const rows = await sequelize.query(
    `SELECT id, name, attributes FROM Products WHERE id = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );

  return rowToProduct(rows[0]);
}

module.exports = {
  loadProducts,
  filterNum,
  filterStr,
  filterTag,
  setKey,
};
