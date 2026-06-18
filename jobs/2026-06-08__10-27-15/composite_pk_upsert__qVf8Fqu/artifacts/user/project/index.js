'use strict';

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Define UserRole model with a composite primary key
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
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    tableName: 'user_roles',
    timestamps: false,
  }
);

const app = express();
app.use(express.json());

// POST /roles — Assign or update a role for a user
app.post('/roles', async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;

    const [record] = await UserRole.upsert(
      { userId, roleId, assignedBy, isActive: true },
      { returning: true }
    );

    res.status(200).json({
      userId: record.userId,
      roleId: record.roleId,
      assignedBy: record.assignedBy,
      isActive: record.isActive,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /roles/:userId/:roleId — Retrieve a role assignment
app.get('/roles/:userId/:roleId', async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    const record = await UserRole.findOne({
      where: { userId: parseInt(userId, 10), roleId: parseInt(roleId, 10) },
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync database and start server
sequelize.sync().then(() => {
  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });
});
