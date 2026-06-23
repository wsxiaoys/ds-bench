'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Company = sequelize.define('Company', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'companies',
  timestamps: false,
});

module.exports = Company;
