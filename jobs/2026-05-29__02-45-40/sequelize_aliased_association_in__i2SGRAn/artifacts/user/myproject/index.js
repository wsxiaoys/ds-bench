const { Sequelize, DataTypes } = require('sequelize');

// 1. Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// 2. Define Person model
const Person = sequelize.define('Person', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// 3. Define Mail model
const Mail = sequelize.define('Mail', {
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// 4. Define associations with aliases
Mail.belongsTo(Person, { as: 'sender', foreignKey: 'senderId' });
Mail.belongsTo(Person, { as: 'receiver', foreignKey: 'receiverId' });

// 5. Run the script
async function main() {
  await sequelize.sync({ force: true });

  // Create two persons
  const alice = await Person.create({ name: 'Alice' });
  const bob = await Person.create({ name: 'Bob' });

  // Create a mail with sender Alice and receiver Bob
  await Mail.create({
    content: 'Hello',
    senderId: alice.id,
    receiverId: bob.id,
  });

  // Query the mail, eager loading both sender and receiver using aliases
  const mail = await Mail.findOne({
    include: [
      { model: Person, as: 'sender' },
      { model: Person, as: 'receiver' },
    ],
  });

  // Print the result in the required format
  console.log(`Result: ${mail.sender.name} sent "${mail.content}" to ${mail.receiver.name}`);

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});