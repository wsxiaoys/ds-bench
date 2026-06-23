module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add departmentId column to Users table
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    // 2. Backfill existing rows with departmentId = 1
    await queryInterface.bulkUpdate('Users', { departmentId: 1 }, {});

    // 3. Add foreign key constraint on departmentId referencing Departments(id)
    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'Users_departmentId_fkey',
      references: {
        table: 'Departments',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the foreign key constraint
    await queryInterface.removeConstraint('Users', 'Users_departmentId_fkey');

    // Remove the departmentId column
    await queryInterface.removeColumn('Users', 'departmentId');
  }
};