const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

const User = sequelize.define('User', {
  name: DataTypes.STRING
});

const Product = sequelize.define('Product', {
  title: DataTypes.STRING
});

const Image = sequelize.define('Image', {
  url: DataTypes.STRING,
  imageableId: DataTypes.INTEGER,
  imageableType: DataTypes.STRING
});

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
  as: 'userImageable'
});

Image.belongsTo(Product, {
  foreignKey: 'imageableId',
  constraints: false,
  as: 'productImageable'
});

const app = express();
app.use(express.json());

app.post('/users', async (req, res) => {
  try {
    const user = await User.create({ name: req.body.name });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/products', async (req, res) => {
  try {
    const product = await Product.create({ title: req.body.title });
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/images', async (req, res) => {
  try {
    const image = await Image.create({
      url: req.body.url,
      imageableId: req.body.imageableId,
      imageableType: req.body.imageableType
    });
    res.status(201).json(image);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: 'profilePictures' }]
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }]
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

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
    const result = image.toJSON();
    result.imageable = imageable;
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

sequelize.sync().then(() => {
  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });
});
