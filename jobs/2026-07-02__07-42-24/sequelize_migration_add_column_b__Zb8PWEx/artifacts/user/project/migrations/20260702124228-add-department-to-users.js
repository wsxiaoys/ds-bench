'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Adds a departmentId column of type INTEGER to the Users table.
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 2. Backfills existing rows in the Users table by setting departmentId to 1.
    await queryInterface.bulkUpdate('Users', { departmentId: 1 }, {});

    // 3. Adds a foreign key constraint to the departmentId column, referencing the id column of the Departments table, with CASCADE on update and delete.
    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'fk_users_departmentId',
      references: {
        table: 'Departments',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    // 1. Remove the foreign key constraint
    await queryInterface.removeConstraint('Users', 'fk_users_departmentId');

    // 2. Remove the departmentId column
    await queryInterface.removeColumn('Users', 'departmentId');
  }
};
