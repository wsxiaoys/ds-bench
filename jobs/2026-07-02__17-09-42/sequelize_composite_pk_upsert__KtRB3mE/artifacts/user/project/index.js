const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false,
});

// Define the UserRole model with a composite primary key
const UserRole = sequelize.define(
  'UserRole',
  {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    assignedBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'UserRoles',
    timestamps: false,
  }
);

// Create Express app
const app = express();
app.use(express.json());

// POST /roles - Assign a role to a user
app.post('/roles', async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;

    if (typeof userId !== 'number' || typeof roleId !== 'number' || typeof assignedBy !== 'string') {
      return res.status(400).json({ error: 'userId and roleId must be numbers and assignedBy must be a string' });
    }

    const [record, created] = await UserRole.upsert(
      {
        userId,
        roleId,
        assignedBy,
        isActive: true,
      },
      {
        returning: true,
      }
    );

    res.status(200).json({
      userId: record.userId,
      roleId: record.roleId,
      assignedBy: record.assignedBy,
      isActive: record.isActive,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /roles/:userId/:roleId - Retrieve the role assignment
app.get('/roles/:userId/:roleId', async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    const record = await UserRole.findOne({
      where: {
        userId: parseInt(userId, 10),
        roleId: parseInt(roleId, 10),
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    res.status(200).json({
      userId: record.userId,
      roleId: record.roleId,
      assignedBy: record.assignedBy,
      isActive: record.isActive,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync the database and start the server
(async () => {
  try {
    await sequelize.sync();
    console.log('Database synced successfully.');

    app.listen(3000, () => {
      console.log('Server is running on port 3000');
    });
  } catch (error) {
    console.error('Unable to start the server:', error);
  }
})();