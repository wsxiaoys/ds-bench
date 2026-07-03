module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.bulkUpdate('Users', { departmentId: 1 }, {});

    await queryInterface.addConstraint('Users', {
      fields: ['departmentId'],
      type: 'foreign key',
      name: 'Users_departmentId_fkey',
      references: {
        table: 'Departments',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('Users', 'Users_departmentId_fkey');
    await queryInterface.removeColumn('Users', 'departmentId');
  }
};
