const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Define UserRole model with composite primary key
const UserRole = sequelize.define('UserRole', {
  userId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  roleId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  assignedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  timestamps: false
});

// POST /roles
app.post('/roles', async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;

    if (userId === undefined || roleId === undefined) {
      return res.status(400).json({ error: 'userId and roleId are required' });
    }

    // Use UserRole.upsert() to create or update
    const [instance, created] = await UserRole.upsert({
      userId: Number(userId),
      roleId: Number(roleId),
      assignedBy,
      isActive: true
    });

    return res.status(200).json({
      userId: instance.userId,
      roleId: instance.roleId,
      assignedBy: instance.assignedBy,
      isActive: instance.isActive
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /roles/:userId/:roleId
app.get('/roles/:userId/:roleId', async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    const assignment = await UserRole.findOne({
      where: {
        userId: Number(userId),
        roleId: Number(roleId)
      }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    return res.status(200).json({
      userId: assignment.userId,
      roleId: assignment.roleId,
      assignedBy: assignment.assignedBy,
      isActive: assignment.isActive
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync database and start server
const PORT = 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Unable to connect to the database:', err);
});
