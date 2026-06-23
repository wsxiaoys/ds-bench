const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false
});

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
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
});

app.post('/roles', async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;
    
    // Uses UserRole.upsert() to create or update
    const [record, created] = await UserRole.upsert({
      userId,
      roleId,
      assignedBy,
      isActive: true
    });
    
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

app.get('/roles/:userId/:roleId', async (req, res) => {
  try {
    const { userId, roleId } = req.params;
    const record = await UserRole.findOne({
      where: {
        userId: parseInt(userId, 10),
        roleId: parseInt(roleId, 10)
      }
    });

    if (record) {
      res.status(200).json({
        userId: record.userId,
        roleId: record.roleId,
        assignedBy: record.assignedBy,
        isActive: record.isActive
      });
    } else {
      res.status(404).json({ error: 'Not Found' });
    }
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
