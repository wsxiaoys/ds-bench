const express = require('express');
const { sequelize, User, Product, Image } = require('./models');

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// POST /users
// ---------------------------------------------------------------------------
app.post('/users', async (req, res) => {
  try {
    const user = await User.create({ name: req.body.name });
    return res.status(201).json(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /products
// ---------------------------------------------------------------------------
app.post('/products', async (req, res) => {
  try {
    const product = await Product.create({ title: req.body.title });
    return res.status(201).json(product);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /images
// ---------------------------------------------------------------------------
app.post('/images', async (req, res) => {
  try {
    const { url, imageableId, imageableType } = req.body;
    const image = await Image.create({ url, imageableId, imageableType });
    return res.status(201).json(image);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /users/:id  -> includes profilePictures
// ---------------------------------------------------------------------------
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: 'profilePictures' }],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(user);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /products/:id  -> includes productPhotos
// ---------------------------------------------------------------------------
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }],
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json(product);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /images/:id  -> includes polymorphic `imageable` (User or Product)
// ---------------------------------------------------------------------------
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

    const imageJson = image.toJSON();
    imageJson.imageable = imageable;
    return res.status(200).json(imageJson);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start server after syncing schema
// ---------------------------------------------------------------------------
const PORT = 3000;

sequelize.sync({ force: true }).then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});