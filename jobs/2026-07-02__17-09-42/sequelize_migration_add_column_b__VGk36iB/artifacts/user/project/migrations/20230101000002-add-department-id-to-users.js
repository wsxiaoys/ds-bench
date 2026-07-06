module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add the departmentId column to the Users table
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // Step 2: Backfill existing rows with departmentId = 1
    await queryInterface.bulkUpdate('Users', { departmentId: 1 }, {});

    // Step 3: Add foreign key constraint with CASCADE on update and delete
    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'fk_users_departmentId',
      references: {
        table: 'Departments',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the foreign key constraint first
    await queryInterface.removeConstraint('Users', 'fk_users_departmentId');

    // Then remove the departmentId column
    await queryInterface.removeColumn('Users', 'departmentId');
  }
};