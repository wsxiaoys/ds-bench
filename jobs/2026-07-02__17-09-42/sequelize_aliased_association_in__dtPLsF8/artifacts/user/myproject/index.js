const { Sequelize, DataTypes } = require('sequelize');

// 1. Initialize a Sequelize instance using SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false,
});

// 2. Define the Person model with a `name` field
const Person = sequelize.define('Person', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// 3. Define the Mail model with a `content` field
const Mail = sequelize.define('Mail', {
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// 4. Define associations using aliases.
// A Mail belongs to a Person as a `sender` AND as a `receiver`.
// Specifying `foreignKey` for both aliases prevents the "Include unexpected" error.
Mail.belongsTo(Person, { as: 'sender', foreignKey: 'senderId' });
Mail.belongsTo(Person, { as: 'receiver', foreignKey: 'receiverId' });

// Optional reverse associations for completeness
Person.hasMany(Mail, { as: 'sentMails', foreignKey: 'senderId' });
Person.hasMany(Mail, { as: 'receivedMails', foreignKey: 'receiverId' });

(async () => {
  try {
    // 2. Sync the models (force: true ensures a clean DB on every run)
    await sequelize.sync({ force: true });

    // 3. Create two persons: "Alice" and "Bob"
    const [alice, bob] = await Promise.all([
      Person.create({ name: 'Alice' }),
      Person.create({ name: 'Bob' }),
    ]);

    // 4. Create a mail where the sender is Alice and the receiver is Bob
    await Mail.create({
      content: 'Hello',
      senderId: alice.id,
      receiverId: bob.id,
    });

    // 5. Query the mail, eager loading BOTH the sender and the receiver using aliases
    const mail = await Mail.findOne({
      include: [
        { model: Person, as: 'sender' },
        { model: Person, as: 'receiver' },
      ],
    });

    // 6. Print the result in the exact required format
    console.log(`Result: ${mail.sender.name} sent "${mail.content}" to ${mail.receiver.name}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
})();