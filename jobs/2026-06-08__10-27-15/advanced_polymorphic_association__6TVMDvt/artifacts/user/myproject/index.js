'use strict';

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

// ──────────────────────────────────────────────
// Database
// ──────────────────────────────────────────────
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// ──────────────────────────────────────────────
// Models
// ──────────────────────────────────────────────
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'users',
});

const Product = sequelize.define('Product', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'products',
});

const Image = sequelize.define('Image', {
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  imageableId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  imageableType: {
    type: DataTypes.STRING,       // 'user' | 'product'
    allowNull: false,
  },
}, {
  tableName: 'images',
});

// ──────────────────────────────────────────────
// Polymorphic Associations
//
// User hasMany Image (scope: imageableType = 'user')
// Product hasMany Image (scope: imageableType = 'product')
//
// constraints: false because imageableId is a shared
// foreign key that can point to different tables.
// ──────────────────────────────────────────────
User.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: { imageableType: 'user' },
  as: 'profilePictures',
});

Product.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: { imageableType: 'product' },
  as: 'productPhotos',
});

// belongsTo sides — one per imageableType value so that
// Sequelize knows how to JOIN for the GET /images/:id route.
Image.belongsTo(User, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'user',
});

Image.belongsTo(Product, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'product',
});

// ──────────────────────────────────────────────
// Express App
// ──────────────────────────────────────────────
const app = express();
app.use(express.json());

// ── POST /users ──────────────────────────────
app.post('/users', async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.create({ name });
    return res.status(201).json(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── GET /users/:id ───────────────────────────
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: 'profilePictures' }],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /products ────────────────────────────
app.post('/products', async (req, res) => {
  try {
    const { title } = req.body;
    const product = await Product.create({ title });
    return res.status(201).json(product);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── GET /products/:id ─────────────────────────
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }],
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /images ──────────────────────────────
app.post('/images', async (req, res) => {
  try {
    const { url, imageableId, imageableType } = req.body;

    if (!['user', 'product'].includes(imageableType)) {
      return res.status(400).json({
        error: "imageableType must be 'user' or 'product'",
      });
    }

    const image = await Image.create({ url, imageableId, imageableType });
    return res.status(201).json(image);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── GET /images/:id ───────────────────────────
// Includes the associated User or Product under the key `imageable`.
app.get('/images/:id', async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    let imageable = null;

    if (image.imageableType === 'user') {
      imageable = await User.findByPk(image.imageableId);
    } else if (image.imageableType === 'product') {
      imageable = await Product.findByPk(image.imageableId);
    }

    // Merge imageable into the plain response object
    const result = {
      ...image.toJSON(),
      imageable: imageable ? imageable.toJSON() : null,
    };

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// Bootstrap: sync DB then start server
// ──────────────────────────────────────────────
const PORT = 3000;

sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
    process.exit(1);
  });
