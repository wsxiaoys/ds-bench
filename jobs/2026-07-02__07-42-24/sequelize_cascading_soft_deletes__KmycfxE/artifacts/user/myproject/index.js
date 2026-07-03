const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');

const app = express();
app.use(express.json());

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: '/home/user/myproject/database.sqlite',
  logging: false,
});

// Define User Model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  paranoid: true,
});

// Define Post Model
const Post = sequelize.define('Post', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  paranoid: true,
});

// Define Associations
User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

// Cascading soft-delete hook
User.afterDestroy(async (user, options) => {
  await Post.destroy({
    where: { userId: user.id },
    transaction: options.transaction,
  });
});

// Cascading restore hook
User.beforeRestore(async (user, options) => {
  await Post.restore({
    where: {
      userId: user.id,
      deletedAt: {
        [Op.gte]: user.deletedAt,
      },
    },
    transaction: options.transaction,
  });
});

// Routes

// POST /users — create a user
app.post('/users', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const user = await User.create({ username });
    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /users/:id/posts — create a post for the given user
app.post('/users/:id/posts', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const post = await Post.create({ title, userId: user.id });
    return res.status(201).json(post);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /users/:id — soft-delete the user (and cascade to their posts)
app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await user.destroy();
    return res.status(200).json({ message: 'User soft-deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /users/:id/restore — restore the user (and cascade to their posts)
app.post('/users/:id/restore', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.deletedAt) {
      await user.restore();
    }
    return res.status(200).json({ message: 'User restored successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /posts/:id — get a post if it exists and is not soft-deleted
app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    return res.status(200).json(post);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Sync database and start server
const PORT = 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to sync database:', err);
});
