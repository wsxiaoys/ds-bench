'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Employee = sequelize.define('Employee', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'employees',
  timestamps: false,
});

module.exports = Employee;
