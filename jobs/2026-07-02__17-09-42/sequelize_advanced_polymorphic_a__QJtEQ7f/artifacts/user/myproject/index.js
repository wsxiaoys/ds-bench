'use strict';

const express = require('express');
const { sequelize, User, Product, Image } = require('./models');

const app = express();
app.use(express.json());

const PORT = 3000;

// POST /users
app.post('/users', async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.create({ name });
    res.status(201).json(user.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /products
app.post('/products', async (req, res) => {
  try {
    const { title } = req.body;
    const product = await Product.create({ title });
    res.status(201).json(product.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /images
app.post('/images', async (req, res) => {
  try {
    const { url, imageableId, imageableType } = req.body;

    if (!['user', 'product'].includes(imageableType)) {
      return res.status(400).json({ error: 'imageableType must be "user" or "product"' });
    }

    const image = await Image.create({ url, imageableId, imageableType });
    res.status(201).json(image.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /users/:id
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: 'profilePictures' }],
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /products/:id
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }],
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(product.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /images/:id
app.get('/images/:id', async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    let imageable = null;
    if (image.imageableType === 'user') {
      imageable = await User.findByPk(image.imageableId);
    } else if (image.imageableType === 'product') {
      imageable = await Product.findByPk(image.imageableId);
    }

    const response = image.toJSON();
    response.imageable = imageable ? imageable.toJSON() : null;
    res.status(200).json(response);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start the server after syncing the database
(async () => {
  try {
    await sequelize.sync();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
})();