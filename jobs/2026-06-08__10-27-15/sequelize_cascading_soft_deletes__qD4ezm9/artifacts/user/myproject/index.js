const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

// ── Database ──────────────────────────────────────────────────────────────────
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// ── Models ────────────────────────────────────────────────────────────────────
const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    paranoid: true, // enables soft-delete via deletedAt column
    timestamps: true,
  }
);

const Post = sequelize.define(
  'Post',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    paranoid: true, // enables soft-delete via deletedAt column
    timestamps: true,
  }
);

// ── Associations ──────────────────────────────────────────────────────────────
User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

// ── Hooks: cascading soft-delete & restore ────────────────────────────────────

// After a User is soft-deleted, soft-delete all their Posts
User.addHook('afterDestroy', async (user, options) => {
  await Post.destroy({
    where: { userId: user.id },
    transaction: options.transaction,
  });
});

// After a User is restored, restore all their soft-deleted Posts
User.addHook('afterRestore', async (user, options) => {
  await Post.restore({
    where: { userId: user.id },
    paranoid: false, // look in soft-deleted rows too
    transaction: options.transaction,
  });
});

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// POST /users — create a user
app.post('/users', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.create({ username });
    return res.status(201).json(user);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /users/:id/posts — create a post for a user
app.post('/users/:id/posts', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { title } = req.body;
    const post = await Post.create({ title, userId: user.id });
    return res.status(201).json(post);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /users/:id — soft-delete user (hook cascades to posts)
app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.destroy(); // triggers afterDestroy hook
    return res.status(200).json({ message: 'User soft-deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /users/:id/restore — restore a soft-deleted user (hook cascades to posts)
app.post('/users/:id/restore', async (req, res) => {
  try {
    // paranoid: false so we can find soft-deleted users
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.restore(); // triggers afterRestore hook
    return res.status(200).json({ message: 'User restored' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /posts/:id — fetch a single non-deleted post
app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.status(200).json(post);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const PORT = 3000;

sequelize
  .sync({ force: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
    process.exit(1);
  });
