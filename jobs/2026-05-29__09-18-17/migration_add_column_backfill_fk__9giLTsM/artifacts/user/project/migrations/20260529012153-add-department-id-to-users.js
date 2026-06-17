'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.bulkUpdate('Users', { departmentId: 1 }, {});

    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'users_departmentId_fkey',
      references: {
        table: 'Departments',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('Users', 'users_departmentId_fkey');
    await queryInterface.removeColumn('Users', 'departmentId');
  }
};
