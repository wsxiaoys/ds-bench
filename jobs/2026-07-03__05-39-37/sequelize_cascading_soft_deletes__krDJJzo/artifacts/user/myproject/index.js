const express = require('express');
const { sequelize, User, Post } = require('./db');

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Cascading soft-delete / restore via Sequelize hooks.
//
// Strategy: when a User is soft-deleted, Sequelize stamps its `deletedAt` with
// a timestamp. In the `afterDestroy` hook we copy that *exact* timestamp onto
// every non-deleted Post belonging to the user. When the User is restored, the
// `beforeRestore` hook reads the User's current `deletedAt` and clears the
// `deletedAt` of only those Posts whose `deletedAt` matches it — i.e. the ones
// that were cascaded with this delete. Posts that were soft-deleted
// independently (different `deletedAt`) are left untouched.
// ---------------------------------------------------------------------------

User.addHook('afterDestroy', async (user, options) => {
  // Re-read the user so we get the authoritative `deletedAt` Sequelize just
  // wrote during the paranoid soft-delete.
  const fresh = await User.findByPk(user.id, {
    paranoid: false,
    transaction: options.transaction,
  });
  const deletedAt = fresh ? fresh.deletedAt : user.deletedAt;
  if (!deletedAt) return;

  await Post.update(
    { deletedAt: deletedAt },
    {
      where: { UserId: user.id, deletedAt: null },
      paranoid: false,
      transaction: options.transaction,
    }
  );
});

User.addHook('beforeRestore', async (user, options) => {
  // `user.deletedAt` still holds the old value here (restore hasn't cleared it
  // yet), but re-read to be safe.
  const fresh = await User.findByPk(user.id, {
    paranoid: false,
    transaction: options.transaction,
  });
  const deletedAt = fresh ? fresh.deletedAt : user.deletedAt;
  if (!deletedAt) return;

  await Post.update(
    { deletedAt: null },
    {
      where: { UserId: user.id, deletedAt: deletedAt },
      paranoid: false,
      transaction: options.transaction,
    }
  );
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /users — create a user.
app.post('/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (typeof username !== 'string') {
      return res.status(400).json({ error: 'username (string) is required' });
    }
    const user = await User.create({ username });
    return res.status(201).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/:id/posts — create a post for a user.
app.post('/users/:id/posts', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (typeof title !== 'string') {
      return res.status(400).json({ error: 'title (string) is required' });
    }
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const post = await Post.create({ title, UserId: user.id });
    return res.status(201).json(post);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/:id — soft-delete the user and cascade to posts.
app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.destroy();
    return res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/:id/restore — restore the user and cascade to posts.
app.post('/users/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { paranoid: false });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.deletedAt) {
      return res.status(200).json({ message: 'User was not deleted' });
    }
    await user.restore();
    return res.status(200).json({ message: 'User restored' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /posts/:id — return a post if it exists and is not soft-deleted.
app.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Default paranoid: true means soft-deleted posts are excluded.
    const post = await Post.findByPk(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    return res.status(200).json(post);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const PORT = 3000;

(async () => {
  await sequelize.sync({ force: true });
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
})();

module.exports = app;