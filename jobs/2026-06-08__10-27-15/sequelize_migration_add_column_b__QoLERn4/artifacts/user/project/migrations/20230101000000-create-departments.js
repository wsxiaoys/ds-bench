module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Departments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: Sequelize.STRING
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Departments');
  }
};
