'use strict';

const express = require('express');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
// `cascadeDeletedAt` records the timestamp at which a Post was soft-deleted as
// part of a User cascade. It lets us distinguish "cascade-deleted" posts from
// posts that were soft-deleted independently by a direct DELETE request, so
// that restoring a User only restores the posts that came along with it.
const Post = sequelize.define(
  'Post',
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cascadeDeletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    paranoid: true,
  }
);

const User = sequelize.define(
  'User',
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

User.hasMany(Post, { foreignKey: { allowNull: false } });
Post.belongsTo(User);

// ---------------------------------------------------------------------------
// Cascading paranoid hooks
// ---------------------------------------------------------------------------
// When a User is soft-deleted, also soft-delete every Post that is still
// active. We tag the affected posts with `cascadeDeletedAt` equal to the
// User's `deletedAt` so that a later restore can identify exactly which
// posts were brought down by this particular cascade.
User.afterDestroy(async (user, options) => {
  const cascadeAt = user.dataValues.deletedAt || new Date();
  await Post.update(
    { deletedAt: cascadeAt, cascadeDeletedAt: cascadeAt },
    {
      where: { UserId: user.id, deletedAt: null },
      paranoid: false,
      transaction: options.transaction,
    }
  );
});

// When a User is restored, only restore the Posts that were cascade-deleted
// alongside it (matched by `cascadeDeletedAt` equalling the User's
// `deletedAt`). Posts that were soft-deleted independently remain deleted.
User.beforeRestore(async (user, options) => {
  const cascadeAt = user.dataValues.deletedAt;
  await Post.update(
    { deletedAt: null, cascadeDeletedAt: null },
    {
      where: { UserId: user.id, cascadeDeletedAt: cascadeAt },
      paranoid: false,
      transaction: options.transaction,
    }
  );
});

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

app.post('/users', async (req, res) => {
  try {
    const { username } = req.body || {};
    if (typeof username !== 'string' || username.length === 0) {
      return res.status(400).json({ error: 'username is required' });
    }
    const user = await User.create({ username });
    return res.status(201).json(user.toJSON());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/users/:id/posts', async (req, res) => {
  try {
    const { title } = req.body || {};
    if (typeof title !== 'string' || title.length === 0) {
      return res.status(400).json({ error: 'title is required' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const post = await Post.create({ title, UserId: user.id });
    return res.status(201).json(post.toJSON());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.destroy();
    return res.status(200).json({ message: 'User soft-deleted' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/users/:id/restore', async (req, res) => {
  try {
    // Need to look up the soft-deleted user as well.
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.deletedAt) {
      return res.status(400).json({ error: 'User is not deleted' });
    }
    await user.restore();
    return res.status(200).json({ message: 'User restored' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    return res.status(200).json(post.toJSON());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const PORT = 3000;

(async () => {
  try {
    await sequelize.sync();
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();