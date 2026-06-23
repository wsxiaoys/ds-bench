'use strict';

const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Define User model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'Users',
  timestamps: false,
});

// Define Project model
const Project = sequelize.define('Project', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'Projects',
  timestamps: false,
});

// Define junction (through) model
const UserProject = sequelize.define('UserProject', {
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'UserProjects',
  timestamps: false,
});

// Establish Many-to-Many association using UserProject as the junction model
User.belongsToMany(Project, {
  through: UserProject,
  foreignKey: 'UserId',
  otherKey: 'ProjectId',
});

Project.belongsToMany(User, {
  through: UserProject,
  foreignKey: 'ProjectId',
  otherKey: 'UserId',
});

module.exports = { sequelize, User, Project, UserProject };
