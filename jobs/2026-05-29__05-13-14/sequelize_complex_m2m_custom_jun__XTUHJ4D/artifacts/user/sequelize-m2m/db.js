const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
});

const Project = sequelize.define('Project', {
  name: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
});

const UserProject = sequelize.define('UserProject', {
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

User.belongsToMany(Project, { through: UserProject });
Project.belongsToMany(User, { through: UserProject });

module.exports = { sequelize, User, Project, UserProject };