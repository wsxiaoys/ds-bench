'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add the departmentId column (nullable initially to allow backfill)
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Step 2: Backfill existing rows with departmentId = 1
    await queryInterface.bulkUpdate('Users', { departmentId: 1 }, {});

    // Step 3: Add foreign key constraint referencing Departments(id)
    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'fk_users_departmentId',
      references: {
        table: 'Departments',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Step 1: Remove the foreign key constraint
    await queryInterface.removeConstraint('Users', 'fk_users_departmentId');

    // Step 2: Remove the departmentId column
    await queryInterface.removeColumn('Users', 'departmentId');
  },
};
