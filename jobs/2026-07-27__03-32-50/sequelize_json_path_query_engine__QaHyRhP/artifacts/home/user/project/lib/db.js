"use strict";

const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");

/**
 * Strips Sequelize's "Executing (default): " style prefix from a log line,
 * leaving just the raw SQL statement.
 */
function cleanSqlLine(message) {
  return String(message).replace(/^Executing \([^)]*\):\s*/, "");
}

/**
 * Builds a logging function for Sequelize that appends every executed SQL
 * statement (one per line, in execution order) to the file referenced by
 * the SQL_LOG environment variable, if set.
 */
function createLogger() {
  const sqlLogPath = process.env.SQL_LOG;
  if (!sqlLogPath) {
    return false;
  }
  return (message) => {
    const line = cleanSqlLine(message);
    fs.appendFileSync(sqlLogPath, line + "\n");
  };
}

/**
 * Creates a Sequelize instance pointed at the given SQLite file.
 */
function createSequelize(dbPath) {
  const storage = path.resolve(process.cwd(), dbPath);
  return new Sequelize({
    dialect: "sqlite",
    storage,
    logging: createLogger(),
  });
}

/**
 * Defines (without syncing) the Product model on the given Sequelize
 * instance.
 */
function defineProduct(sequelize) {
  return sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      attributes: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "Products",
      timestamps: false,
    }
  );
}

module.exports = { createSequelize, defineProduct };
