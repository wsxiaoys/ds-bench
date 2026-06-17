const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Model Definitions
const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Product = sequelize.define('Product', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  }
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
});

// Polymorphic Associations
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

Image.prototype.getImageable = function(options) {
  if (!this.imageableType) return Promise.resolve(null);
  const mixinMethodName = `get${this.imageableType.charAt(0).toUpperCase() + this.imageableType.slice(1)}`;
  return this[mixinMethodName](options);
};

Image.belongsTo(User, { foreignKey: 'imageableId', constraints: false });
Image.belongsTo(Product, { foreignKey: 'imageableId', constraints: false });

// Helper for polymorphic include in GET /images/:id
Image.addHook('afterFind', (findResult) => {
  if (!findResult) return;
  if (!Array.isArray(findResult)) findResult = [findResult];
  for (const instance of findResult) {
    if (instance.imageableType === 'user' && instance.User !== undefined) {
      instance.setDataValue('imageable', instance.User);
    } else if (instance.imageableType === 'product' && instance.Product !== undefined) {
      instance.setDataValue('imageable', instance.Product);
    }
    // Remove the specific model keys to clean up the response if desired, 
    // but the requirement is to have it under 'imageable'.
    delete instance.dataValues.User;
    delete instance.dataValues.Product;
  }
});

// Endpoints
app.post('/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/products', async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/images', async (req, res) => {
  try {
    const image = await Image.create(req.body);
    res.status(201).json(image);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: 'profilePictures' }]
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }]
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/images/:id', async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id, {
      include: [User, Product]
    });
    if (!image) return res.status(404).json({ error: 'Image not found' });
    res.json(image);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
