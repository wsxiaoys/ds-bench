'use strict';

const express = require('express');
const sequelize = require('./db');

// Import models so associations are registered before any query runs
require('./models');

const companiesRouter = require('./routes/companies');

const app = express();
const PORT = 3000;

app.use(express.json());

// Mount routes
app.use('/', companiesRouter);

// Connect to the database, then start listening
sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection established.');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
