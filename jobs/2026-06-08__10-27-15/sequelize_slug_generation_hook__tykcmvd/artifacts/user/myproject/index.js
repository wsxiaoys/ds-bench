const express = require('express');
const sequelize = require('./db');

// Import the model so Sequelize registers it before sync
require('./models/Article');

const articleRoutes = require('./routes/articles');

const app = express();
const PORT = 3000;

app.use(express.json());

// Mount article routes
app.use('/articles', articleRoutes);

// Sync all models then start listening
sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
