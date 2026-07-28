const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// 1. Parse Arguments
function parseArgs(args) {
  const options = {
    db: './data.sqlite'
  };
  const command = args[0];
  
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const val = args[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        options[key] = val;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  return { command, options };
}

const args = process.argv.slice(2);
const { command, options } = parseArgs(args);

// 2. Setup SQL Logger
function logSql(sql) {
  const logPath = process.env.SQL_LOG;
  if (logPath) {
    let sqlStatement = sql.replace(/^Executing \([^)]+\): /, '');
    sqlStatement = sqlStatement.replace(/\s+/g, ' ').trim();
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logPath, sqlStatement + '\n');
  }
}

// 3. Initialize Sequelize
const dbPath = options.db || './data.sqlite';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: logSql,
  define: {
    timestamps: false
  }
});

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  attributes: {
    type: DataTypes.JSON,
    allowNull: false
  }
}, {
  tableName: 'Products',
  timestamps: false
});

// 4. Command Handlers
async function handleLoad() {
  const filePath = options.file;
  if (!filePath) {
    console.error("Error: --file option is required for load command.");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exit(1);
  }

  let data;
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(fileContent);
  } catch (err) {
    console.error("Error reading or parsing JSON file:", err.message);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error("Error: JSON file must contain an array of products.");
    process.exit(1);
  }

  await Product.sync({ force: true });

  const productsToCreate = data.map(item => ({
    name: item.name,
    attributes: item.attributes
  }));

  await Product.bulkCreate(productsToCreate);
  process.exit(0);
}

async function handleFilterNum() {
  const dotPath = options.path;
  const opName = options.op;
  const valueStr = options.value;

  if (!dotPath || !opName || valueStr === undefined) {
    console.error("Error: --path, --op, and --value are required for filter-num command.");
    process.exit(1);
  }

  const opMap = {
    eq: '=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<='
  };

  const op = opMap[opName];
  if (!op) {
    console.error(`Error: Invalid operator '${opName}'. Must be one of eq, gt, gte, lt, lte.`);
    process.exit(1);
  }

  const value = Number(valueStr);
  if (isNaN(value)) {
    console.error(`Error: Value '${valueStr}' is not a valid number.`);
    process.exit(1);
  }

  const jsonPath = '$.' + dotPath;

  const results = await Product.findAll({
    where: sequelize.literal(`json_type(attributes, :jsonPath) IN ('integer', 'real') AND CAST(json_extract(attributes, :jsonPath) AS NUMERIC) ${op} :value`),
    replacements: { jsonPath, value },
    order: [['id', 'ASC']]
  });

  const output = results.map(r => ({
    id: Number(r.id),
    name: r.name,
    attributes: typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes
  }));

  console.log(JSON.stringify(output, null, 2));
}

async function handleFilterStr() {
  const dotPath = options.path;
  const value = options.value;

  if (!dotPath || value === undefined) {
    console.error("Error: --path and --value are required for filter-str command.");
    process.exit(1);
  }

  const jsonPath = '$.' + dotPath;

  const results = await Product.findAll({
    where: sequelize.literal(`json_type(attributes, :jsonPath) = 'text' AND json_extract(attributes, :jsonPath) = :value`),
    replacements: { jsonPath, value },
    order: [['id', 'ASC']]
  });

  const output = results.map(r => ({
    id: Number(r.id),
    name: r.name,
    attributes: typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes
  }));

  console.log(JSON.stringify(output, null, 2));
}

async function handleFilterTag() {
  const dotPath = options.path;
  const value = options.value;

  if (!dotPath || value === undefined) {
    console.error("Error: --path and --value are required for filter-tag command.");
    process.exit(1);
  }

  const jsonPath = '$.' + dotPath;

  const results = await Product.findAll({
    where: sequelize.literal(`json_type(attributes, :jsonPath) = 'array' AND EXISTS (SELECT 1 FROM json_each(attributes, :jsonPath) WHERE value = :value)`),
    replacements: { jsonPath, value },
    order: [['id', 'ASC']]
  });

  const output = results.map(r => ({
    id: Number(r.id),
    name: r.name,
    attributes: typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes
  }));

  console.log(JSON.stringify(output, null, 2));
}

async function handleSetKey() {
  const idStr = options.id;
  const dotPath = options.path;
  const jsonLiteral = options.json;

  if (!idStr || !dotPath || jsonLiteral === undefined) {
    console.error("Error: --id, --path, and --json are required for set-key command.");
    process.exit(1);
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    console.error(`Error: Invalid ID '${idStr}'. Must be an integer.`);
    process.exit(1);
  }

  try {
    JSON.parse(jsonLiteral);
  } catch (err) {
    console.error(`Error: Invalid JSON literal: ${jsonLiteral}`);
    process.exit(1);
  }

  const product = await Product.findByPk(id);
  if (!product) {
    console.error(`Error: Product with ID ${id} not found.`);
    process.exit(1);
  }

  const jsonPath = '$.' + dotPath;

  await sequelize.query(
    `UPDATE Products SET attributes = json_set(attributes, :jsonPath, json(:jsonLiteral)) WHERE id = :id`,
    {
      replacements: { jsonPath, jsonLiteral, id },
      type: Sequelize.QueryTypes.UPDATE
    }
  );

  const updatedProduct = await Product.findByPk(id);
  const output = {
    id: Number(updatedProduct.id),
    name: updatedProduct.name,
    attributes: typeof updatedProduct.attributes === 'string' ? JSON.parse(updatedProduct.attributes) : updatedProduct.attributes
  };

  console.log(JSON.stringify(output, null, 2));
}

// 5. Main Execution
async function main() {
  if (!command) {
    console.error("Error: No command specified.");
    process.exit(1);
  }

  try {
    switch (command) {
      case 'load':
        await handleLoad();
        break;
      case 'filter-num':
        await handleFilterNum();
        break;
      case 'filter-str':
        await handleFilterStr();
        break;
      case 'filter-tag':
        await handleFilterTag();
        break;
      case 'set-key':
        await handleSetKey();
        break;
      default:
        console.error(`Error: Unknown command '${command}'`);
        process.exit(1);
    }
  } catch (err) {
    console.error("Error executing command:", err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
