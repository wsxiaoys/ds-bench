const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
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

Mail.belongsTo(Person, { as: 'sender', foreignKey: 'senderId' });
Mail.belongsTo(Person, { as: 'receiver', foreignKey: 'receiverId' });

async function run() {
  try {
    await sequelize.sync({ force: true });

    const alice = await Person.create({ name: 'Alice' });
    const bob = await Person.create({ name: 'Bob' });

    await Mail.create({
      content: 'Hello',
      senderId: alice.id,
      receiverId: bob.id
    });

    const mail = await Mail.findOne({
      include: [
        { model: Person, as: 'sender' },
        { model: Person, as: 'receiver' }
      ]
    });

    console.log(`Result: ${mail.sender.name} sent "${mail.content}" to ${mail.receiver.name}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

run();
