const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// Define User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  paranoid: true,
});

// Define Post model
const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  paranoid: true,
});

// Associations
User.hasMany(Post, { foreignKey: 'UserId', as: 'Posts' });
Post.belongsTo(User, { foreignKey: 'UserId', as: 'User' });

// Cascading soft delete hook
User.addHook('afterDestroy', async (user, options) => {
  await Post.update(
    { deletedAt: new Date() },
    {
      where: { UserId: user.id },
      transaction: options.transaction,
    }
  );
});

// Cascading restore hook
User.addHook('afterRestore', async (user, options) => {
  await Post.update(
    { deletedAt: null },
    {
      where: { UserId: user.id },
      paranoid: false,
      transaction: options.transaction,
    }
  );
});

// POST /users - Create a user
app.post('/users', async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.create({ username });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /users/:id/posts - Create a post for a user
app.post('/users/:id/posts', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { title } = req.body;
    const post = await Post.create({ title, UserId: user.id });
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /users/:id - Soft-delete a user and their posts
app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.destroy();
    res.status(200).json({ message: 'User and associated posts soft-deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /users/:id/restore - Restore a soft-deleted user and their posts
app.post('/users/:id/restore', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.restore();
    res.status(200).json({ message: 'User and associated posts restored' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /posts/:id - Get a post (returns 404 if soft-deleted)
app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.status(200).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start the server
const PORT = 3000;
sequelize.sync({ force: true }).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});