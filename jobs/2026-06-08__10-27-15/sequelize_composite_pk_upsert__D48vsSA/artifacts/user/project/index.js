const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

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
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  timestamps: false
});

app.post('/roles', async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;
    
    // upsert returns [instance, created]
    const [instance] = await UserRole.upsert({
      userId,
      roleId,
      assignedBy,
      isActive: true
    });
    
    res.status(200).json(instance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/roles/:userId/:roleId', async (req, res) => {
  try {
    const { userId, roleId } = req.params;
    const roleAssignment = await UserRole.findOne({
      where: {
        userId,
        roleId
      }
    });

    if (roleAssignment) {
      res.status(200).json(roleAssignment);
    } else {
      res.status(404).json({ message: 'Role assignment not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
