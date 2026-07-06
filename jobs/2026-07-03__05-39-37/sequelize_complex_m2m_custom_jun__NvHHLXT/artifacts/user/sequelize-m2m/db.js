const { Sequelize, DataTypes } = require('sequelize');

// Initialize Sequelize with SQLite dialect
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Define the User model
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  timestamps: false,
});

// Define the Project model
const Project = sequelize.define('Project', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  timestamps: false,
});

// Define the UserProject junction model with a custom `role` attribute
const UserProject = sequelize.define('UserProject', {
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: false,
});

// Establish Many-to-Many association using UserProject as the junction model
User.belongsToMany(Project, { through: UserProject });
Project.belongsToMany(User, { through: UserProject });

module.exports = {
  sequelize,
  User,
  Project,
  UserProject,
};