const { Sequelize, DataTypes } = require('sequelize');

// Initialize a Sequelize instance using SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// Create a Person model with a name (STRING) field
const Person = sequelize.define('Person', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Create a Mail model with a content (STRING) field
const Mail = sequelize.define('Mail', {
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Define associations: a Mail belongs to a Person as a sender and as a receiver
Mail.belongsTo(Person, { as: 'sender', foreignKey: 'senderId' });
Mail.belongsTo(Person, { as: 'receiver', foreignKey: 'receiverId' });

async function main() {
  // Sync the models (clean database on each run)
  await sequelize.sync({ force: true });

  // Create two persons: "Alice" and "Bob"
  const alice = await Person.create({ name: 'Alice' });
  const bob = await Person.create({ name: 'Bob' });

  // Create a mail with content "Hello" where the sender is Alice and receiver is Bob
  await Mail.create({
    content: 'Hello',
    senderId: alice.id,
    receiverId: bob.id,
  });

  // Query the mail from the database, eager loading BOTH the sender and the receiver
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