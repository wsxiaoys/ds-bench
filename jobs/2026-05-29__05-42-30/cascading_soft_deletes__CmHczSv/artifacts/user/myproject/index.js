const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
  logging: false,
});

const User = sequelize.define(
  "User",
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    paranoid: true,
  }
);

const Post = sequelize.define(
  "Post",
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    paranoid: true,
  }
);

User.hasMany(Post, { foreignKey: { allowNull: false }, onDelete: "CASCADE" });
Post.belongsTo(User, { foreignKey: { allowNull: false } });

User.addHook("afterDestroy", async (user, options) => {
  await Post.destroy({
    where: { UserId: user.id },
    transaction: options.transaction,
  });
});

User.addHook("afterRestore", async (user, options) => {
  await Post.restore({
    where: { UserId: user.id },
    transaction: options.transaction,
  });
});

app.post("/users", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    const user = await User.create({ username });
    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: "failed to create user" });
  }
});

app.post("/users/:id/posts", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    const post = await Post.create({ title, UserId: user.id });
    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).json({ error: "failed to create post" });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    await user.destroy();
    return res.status(200).json({ message: "user deleted" });
  } catch (error) {
    return res.status(500).json({ error: "failed to delete user" });
  }
});

app.post("/users/:id/restore", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    await user.restore();
    return res.status(200).json({ message: "user restored" });
  } catch (error) {
    return res.status(500).json({ error: "failed to restore user" });
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "post not found" });
    }

    return res.status(200).json(post);
  } catch (error) {
    return res.status(500).json({ error: "failed to fetch post" });
  }
});

const start = async () => {
  await sequelize.sync({ force: true });
  app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
  });
};

start();
