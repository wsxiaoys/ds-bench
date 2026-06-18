const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
  logging: false,
});

const UserRole = sequelize.define(
  "UserRole",
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
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
    tableName: "user_roles",
    timestamps: false,
  }
);

app.post("/roles", async (req, res) => {
  try {
    const { userId, roleId, assignedBy } = req.body;

    if (userId === undefined || roleId === undefined || !assignedBy) {
      return res.status(400).json({
        error: "userId, roleId, and assignedBy are required",
      });
    }

    const upsertValues = {
      userId,
      roleId,
      assignedBy,
      isActive: true,
    };

    await UserRole.upsert(upsertValues);

    const record = await UserRole.findByPk({ userId, roleId });

    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/roles/:userId/:roleId", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);
    const roleId = Number.parseInt(req.params.roleId, 10);

    if (Number.isNaN(userId) || Number.isNaN(roleId)) {
      return res.status(400).json({ error: "Invalid userId or roleId" });
    }

    const record = await UserRole.findByPk({ userId, roleId });

    if (!record) {
      return res.status(404).json({ error: "Role assignment not found" });
    }

    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = 3000;

sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
  });
