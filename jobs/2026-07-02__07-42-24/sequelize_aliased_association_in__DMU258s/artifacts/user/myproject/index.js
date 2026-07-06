const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

async function main() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
  });

  const Person = sequelize.define('Person', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });

  const Mail = sequelize.define('Mail', {
    content: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });

  // Define associations
  Mail.belongsTo(Person, { as: 'sender', foreignKey: 'senderId' });
  Mail.belongsTo(Person, { as: 'receiver', foreignKey: 'receiverId' });

  // Sync models
  await sequelize.sync({ force: true });

  // Create persons
  const alice = await Person.create({ name: 'Alice' });
  const bob = await Person.create({ name: 'Bob' });

  // Create mail
  await Mail.create({
    content: 'Hello',
    senderId: alice.id,
    receiverId: bob.id
  });

  // Query mail with eager loading
  const mail = await Mail.findOne({
    include: [
      { model: Person, as: 'sender' },
      { model: Person, as: 'receiver' }
    ]
  });

  if (mail && mail.sender && mail.receiver) {
    console.log(`Result: ${mail.sender.name} sent "${mail.content}" to ${mail.receiver.name}`);
  } else {
    console.log('Error: Mail or associated persons not found.');
  }

  await sequelize.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
