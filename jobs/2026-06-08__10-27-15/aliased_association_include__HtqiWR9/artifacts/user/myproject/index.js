const { Sequelize, DataTypes } = require('sequelize');

// 1. Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// 2. Define the Person model
const Person = sequelize.define('Person', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// 3. Define the Mail model
const Mail = sequelize.define('Mail', {
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// 4. Define aliased associations:
//    A Mail belongs to a Person as "sender"
//    A Mail belongs to a Person as "receiver"
Mail.belongsTo(Person, { as: 'sender', foreignKey: 'senderId' });
Mail.belongsTo(Person, { as: 'receiver', foreignKey: 'receiverId' });

(async () => {
  // 5. Sync models (force: true drops & recreates tables each run)
  await sequelize.sync({ force: true });

  // 6. Create two persons
  const alice = await Person.create({ name: 'Alice' });
  const bob = await Person.create({ name: 'Bob' });

  // 7. Create a mail from Alice to Bob
  await Mail.create({
    content: 'Hello',
    senderId: alice.id,
    receiverId: bob.id,
  });

  // 8. Query the mail with eager loading of both aliases
  const mail = await Mail.findOne({
    include: [
      { model: Person, as: 'sender' },
      { model: Person, as: 'receiver' },
    ],
  });

  // 9. Print result in the required format
  console.log(`Result: ${mail.sender.name} sent "${mail.content}" to ${mail.receiver.name}`);

  await sequelize.close();
})();
