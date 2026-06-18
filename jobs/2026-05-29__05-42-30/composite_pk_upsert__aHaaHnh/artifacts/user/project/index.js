const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// Define UserRole model with composite primary key
const UserRole = sequelize.define('UserRole', {
  userId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  roleId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  assignedBy: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  timestamps: false,
});

const app = express();
app.use(express.json());

// POST /roles - Assign a role to a user using upsert
app.post('/roles', async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;
    await UserRole.upsert({
      userId,
      roleId,
      assignedBy,
      isActive: true,
    });
    const record = await UserRole.findOne({
      where: { userId, roleId },
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /roles/:userId/:roleId - Retrieve a role assignment
app.get('/roles/:userId/:roleId', async (req, res) => {
  try {
    const { userId, roleId } = req.params;
    const record = await UserRole.findOne({
      where: { userId: Number(userId), roleId: Number(roleId) },
    });
    if (!record) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync database and start server
sequelize.sync().then(() => {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
});