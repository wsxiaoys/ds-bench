'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Department = sequelize.define('Department', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'departments',
  timestamps: false,
});

module.exports = Department;
