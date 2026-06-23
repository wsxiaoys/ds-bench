const express = require('express');
const router = express.Router();
const { User, Product, Image } = require('../models');

// POST /users
router.post('/users', async (req, res) => {
  try {
    const user = await User.create({ name: req.body.name });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /products
router.post('/products', async (req, res) => {
  try {
    const product = await Product.create({ title: req.body.title });
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /images
router.post('/images', async (req, res) => {
  try {
    const image = await Image.create({
      url: req.body.url,
      imageableId: req.body.imageableId,
      imageableType: req.body.imageableType,
    });
    res.status(201).json(image);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: 'profilePictures' }],
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /products/:id
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }],
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /images/:id
router.get('/images/:id', async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    let imageable = null;
    if (image.imageableType === 'user') {
      const user = await User.findByPk(image.imageableId);
      imageable = user;
    } else if (image.imageableType === 'product') {
      const product = await Product.findByPk(image.imageableId);
      imageable = product;
    }

    const result = image.toJSON();
    result.imageable = imageable;
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;