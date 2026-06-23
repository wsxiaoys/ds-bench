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
});

app.post('/users', async (req, res) => {
  try {
    const user = await User.create({ username: req.body.username });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/users', async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
