const express = require('express');
const { sequelize } = require('./models');
const { User } = require('./models');

const app = express();
app.use(express.json());

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
