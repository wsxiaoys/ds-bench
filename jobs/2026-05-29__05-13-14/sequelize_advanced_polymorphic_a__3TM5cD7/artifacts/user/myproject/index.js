const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "database.sqlite",
  logging: false
});

const User = sequelize.define("User", {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Product = sequelize.define("Product", {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Image = sequelize.define("Image", {
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
  as: "profilePictures",
  foreignKey: "imageableId",
  constraints: false,
  scope: {
    imageableType: "user"
  }
});

Product.hasMany(Image, {
  as: "productPhotos",
  foreignKey: "imageableId",
  constraints: false,
  scope: {
    imageableType: "product"
  }
});

Image.belongsTo(User, {
  as: "user",
  foreignKey: "imageableId",
  constraints: false
});

Image.belongsTo(Product, {
  as: "product",
  foreignKey: "imageableId",
  constraints: false
});

app.post("/users", async (req, res) => {
  try {
    const user = await User.create({ name: req.body.name });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/products", async (req, res) => {
  try {
    const product = await Product.create({ title: req.body.title });
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/images", async (req, res) => {
  try {
    const { url, imageableId, imageableType } = req.body;
    if (!url || !imageableId || !imageableType) {
      return res.status(400).json({ error: "url, imageableId, and imageableType are required" });
    }
    if (!['user', 'product'].includes(imageableType)) {
      return res.status(400).json({ error: "imageableType must be 'user' or 'product'" });
    }
    const image = await Image.create({ url, imageableId, imageableType });
    res.status(201).json(image);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Image, as: "profilePictures" }]
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: Image, as: "productPhotos" }]
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/images/:id", async (req, res) => {
  try {
    const image = await Image.findByPk(req.params.id, {
      include: [
        { model: User, as: "user" },
        { model: Product, as: "product" }
      ]
    });
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    const payload = image.toJSON();
    payload.imageable = payload.imageableType === "user" ? payload.user : payload.product;
    delete payload.user;
    delete payload.product;

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const start = async () => {
  try {
    await sequelize.sync();
    app.listen(3000, () => {
      console.log("Server listening on port 3000");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
