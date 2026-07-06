const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Define Models
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'users'
});

const Product = sequelize.define('Product', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'products'
});

const Image = sequelize.define('Image', {
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  imageableId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  imageableType: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'images'
});

// Define Polymorphic Associations
User.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'user'
  },
  as: 'profilePictures'
});

Product.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'product'
  },
  as: 'productPhotos'
});

Image.belongsTo(User, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'user'
});

Image.belongsTo(Product, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'product'
});

// POST /users
app.post('/users', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const user = await User.create({ name });
    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /products
app.post('/products', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const product = await Product.create({ title });
    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /images
app.post('/images', async (req, res) => {
  try {
    const { url, imageableId, imageableType } = req.body;
    if (!url || !imageableId || !imageableType) {
      return res.status(400).json({ error: 'url, imageableId, and imageableType are required' });
    }
    if (imageableType !== 'user' && imageableType !== 'product') {
      return res.status(400).json({ error: 'imageableType must be "user" or "product"' });
    }

    // Verify parent exists
    if (imageableType === 'user') {
      const user = await User.findByPk(imageableId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      const product = await Product.findByPk(imageableId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
    }

    const image = await Image.create({ url, imageableId, imageableType });
    return res.status(201).json(image);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /users/:id
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: 'profilePictures' }]
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /products/:id
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }]
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /images/:id
app.get('/images/:id', async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user' },
        { model: Product, as: 'product' }
      ]
    });
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageJson = image.toJSON();
    if (imageJson.imageableType === 'user') {
      imageJson.imageable = imageJson.user || null;
    } else if (imageJson.imageableType === 'product') {
      imageJson.imageable = imageJson.product || null;
    } else {
      imageJson.imageable = null;
    }
    delete imageJson.user;
    delete imageJson.product;

    return res.status(200).json(imageJson);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Sync Database and Start Server
const PORT = 3000;
sequelize.sync().then(() => {
  console.log('Database synchronized.');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to synchronize database:', err);
});
