const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  paranoid: true,
  hooks: {
    beforeDestroy: async (user, options) => {
      // Find all posts that belong to this user and are not already soft-deleted
      const posts = await Post.findAll({
        where: { userId: user.id, deletedAt: null },
        paranoid: false
      });
      // Soft-delete each post
      for (const post of posts) {
        await post.destroy({ hooks: false });
      }
    }
  }
});

const Post = sequelize.define('Post', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  paranoid: true
});

User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });

const app = express();
app.use(express.json());

app.post('/users', async (req, res) => {
  try {
    const user = await User.create({ username: req.body.username });
    res.status(201).json(user.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/users/:id/posts', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const post = await Post.create({ title: req.body.title, userId: user.id });
    res.status(201).json(post.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.destroy();
    res.status(200).json({ message: 'User soft-deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/users/:id/restore', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Find all posts that were soft-deleted with this user
    const posts = await Post.findAll({
      where: { userId: user.id },
      paranoid: false
    });
    // Restore all soft-deleted posts
    for (const post of posts) {
      if (post.deletedAt) {
        await post.restore();
      }
    }
    // Restore the user
    await user.restore();
    res.status(200).json({ message: 'User restored' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.status(200).json(post.toJSON());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

sequelize.sync().then(() => {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
});
