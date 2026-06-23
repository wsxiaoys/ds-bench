'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. Add departmentId column
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true, // Initially allow null so we can add it to existing rows
    });

    // 2. Backfill existing rows
    await queryInterface.bulkUpdate('Users', { departmentId: 1 });

    // 3. Add foreign key constraint
    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'fk_users_departmentId', // Giving it a name to easily remove it later
      references: {
        table: 'Departments',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  async down (queryInterface, Sequelize) {
    // 1. Remove foreign key constraint
    await queryInterface.removeConstraint('Users', 'fk_users_departmentId');

    // 2. Remove departmentId column
    await queryInterface.removeColumn('Users', 'departmentId');
  }
};
