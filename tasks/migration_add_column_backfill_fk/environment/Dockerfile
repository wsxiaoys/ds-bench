FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep sqlite3 && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    npm init -y && \
    npm install sequelize sqlite3 && \
    npm install -D sequelize-cli && \
    npx sequelize-cli init && \
    cat > config/config.json <<'EOF'
{
  "development": {
    "dialect": "sqlite",
    "storage": "./database.sqlite"
  }
}
EOF

RUN cd /home/user/project && \
    cat > migrations/20230101000000-create-departments.js <<'EOF'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Departments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: Sequelize.STRING
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Departments');
  }
};
EOF

RUN cd /home/user/project && \
    cat > migrations/20230101000001-create-users.js <<'EOF'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: Sequelize.STRING
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Users');
  }
};
EOF

RUN cd /home/user/project && \
    npx sequelize-cli db:migrate && \
    sqlite3 database.sqlite "INSERT INTO Departments (name) VALUES ('Engineering');" && \
    sqlite3 database.sqlite "INSERT INTO Users (name) VALUES ('Alice');" && \
    sqlite3 database.sqlite "INSERT INTO Users (name) VALUES ('Bob');"

LABEL Author="generate-harbor-tasks"
LABEL Description="Sequelize project with Departments and Users tables initialized."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep sqlite3
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for Sequelize CLI
#   - /home/user/project: Sequelize project initialized with sqlite database and two tables (Departments, Users).
