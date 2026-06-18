const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

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

User.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'user'
  },
  as: 'profilePictures'
});
Image.belongsTo(User, { foreignKey: 'imageableId', constraints: false });

Product.hasMany(Image, {
  foreignKey: 'imageableId',
  constraints: false,
  scope: {
    imageableType: 'product'
  },
  as: 'productPhotos'
});
Image.belongsTo(Product, { foreignKey: 'imageableId', constraints: false });

Image.prototype.getImageable = async function(options) {
  if (this.imageableType === 'user') {
    return await this.getUser(options);
  } else if (this.imageableType === 'product') {
    return await this.getProduct(options);
  }
  return null;
};

app.post('/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/products', async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/images', async (req, res) => {
  try {
    const image = await Image.create(req.body);
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
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: 'productPhotos' }]
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/images/:id', async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id);
    if (!image) return res.status(404).json({ error: 'Not found' });

    const imageable = await image.getImageable();
    
    const response = image.toJSON();
    response.imageable = imageable;

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
