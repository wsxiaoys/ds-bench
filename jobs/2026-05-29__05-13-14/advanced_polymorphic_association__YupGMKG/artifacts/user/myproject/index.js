const express = require('express');
const { sequelize } = require('./models');
const routes = require('./routes');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(routes);

sequelize.sync({ force: true }).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});