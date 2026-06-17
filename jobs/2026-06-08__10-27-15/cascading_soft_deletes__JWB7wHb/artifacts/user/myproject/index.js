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
  username: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  paranoid: true
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

// Hooks for cascading soft delete
User.addHook('afterDestroy', async (user, options) => {
  await Post.destroy({
    where: { userId: user.id },
    transaction: options.transaction
  });
});

// Hooks for cascading restore
User.addHook('afterRestore', async (user, options) => {
  await Post.restore({
    where: { userId: user.id },
    transaction: options.transaction
  });
});

// Routes
app.post('/users', async (req, res) => {
  try {
    const user = await User.create({ username: req.body.username });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/users/:id/posts', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const post = await Post.create({ 
      title: req.body.title,
      userId: user.id
    });
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await user.destroy();
    res.status(200).send('OK');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/users/:id/restore', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { paranoid: false });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    await user.restore();
    res.status(200).send('OK');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    res.status(200).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = 3000;
sequelize.sync({ force: true }).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Unable to connect to the database:', err);
});
