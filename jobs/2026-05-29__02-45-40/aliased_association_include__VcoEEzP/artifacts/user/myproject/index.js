const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
  logging: false,
});

const Person = sequelize.define("Person", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Mail = sequelize.define("Mail", {
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

Mail.belongsTo(Person, {
  as: "sender",
  foreignKey: {
    name: "senderId",
    allowNull: false,
  },
});

Mail.belongsTo(Person, {
  as: "receiver",
  foreignKey: {
    name: "receiverId",
    allowNull: false,
  },
});

const run = async () => {
  await sequelize.sync({ force: true });

  const alice = await Person.create({ name: "Alice" });
  const bob = await Person.create({ name: "Bob" });

  await Mail.create({
    content: "Hello",
    senderId: alice.id,
    receiverId: bob.id,
  });

  const mail = await Mail.findOne({
    include: [
      { model: Person, as: "sender" },
      { model: Person, as: "receiver" },
    ],
  });

  if (!mail) {
    throw new Error("Mail not found");
  }

  console.log(
    `Result: ${mail.sender.name} sent "${mail.content}" to ${mail.receiver.name}`
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
