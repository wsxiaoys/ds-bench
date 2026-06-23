'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
    });
    
    await queryInterface.bulkUpdate('Users', { departmentId: 1 }, {});
    
    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'Users_departmentId_fk',
      references: {
        table: 'Departments',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Users', 'Users_departmentId_fk');
    await queryInterface.removeColumn('Users', 'departmentId');
  }
};