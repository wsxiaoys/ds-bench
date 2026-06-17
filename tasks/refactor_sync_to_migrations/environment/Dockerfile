FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "express-sequelize-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "sequelize": "^6.37.5",
    "sqlite3": "^5.1.7"
  }
}
EOF

RUN cd /home/user/project && \
    cat >index.js <<'EOF'
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

app.post('/users', async (req, res) => {
  try {
    const user = await User.create({ username: req.body.username });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/users', async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});

sequelize.sync({ force: true }).then(() => {
  app.listen(3000, () => {
    console.log('Server is running on port 3000');
  });
});
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Express app with Sequelize using sync() instead of migrations."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - Node.js v24 for running the Express server and Sequelize CLI
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages: pytest-xprocess requests
#   - /home/user/project: project directory containing package.json and index.js
