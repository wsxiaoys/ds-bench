'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add the departmentId column to the Users table.
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 2. Backfill existing rows so they reference department id 1.
    await queryInterface.bulkUpdate('Users', {
      departmentId: 1,
    });

    // 3. Add a foreign key constraint with CASCADE on update and delete.
    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'users_departmentId_fkey',
      references: {
        table: 'Departments',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the foreign key constraint first, then drop the column.
    await queryInterface.removeConstraint('Users', 'users_departmentId_fkey');
    await queryInterface.removeColumn('Users', 'departmentId');
  },
};