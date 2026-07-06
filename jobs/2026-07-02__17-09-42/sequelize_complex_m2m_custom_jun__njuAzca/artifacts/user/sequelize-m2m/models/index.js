const sequelize = require('../db');
const User = require('./User');
const Project = require('./Project');
const UserProject = require('./UserProject');

// Establish Many-to-Many association between User and Project
// using UserProject as the through (junction) table with a `role` column.
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

module.exports = {
  sequelize,
  User,
  Project,
  UserProject,
};
