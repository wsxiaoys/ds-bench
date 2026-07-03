const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false
});

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
  tableName: 'UserRoles',
  timestamps: false
});

const app = express();
app.use(express.json());

app.post('/roles', async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;
    const [record, created] = await UserRole.upsert({
      userId,
      roleId,
      assignedBy,
      isActive: true
    });
    const result = await UserRole.findOne({ where: { userId, roleId } });
    res.status(200).json({
      userId: result.userId,
      roleId: result.roleId,
      assignedBy: result.assignedBy,
      isActive: result.isActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/roles/:userId/:roleId', async (req, res) => {
  try {
    const { userId, roleId } = req.params;
    const record = await UserRole.findOne({ where: { userId, roleId } });
    if (!record) {
      return res.status(404).json({ error: 'Not Found' });
    }
    res.status(200).json({
      userId: record.userId,
      roleId: record.roleId,
      assignedBy: record.assignedBy,
      isActive: record.isActive
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
