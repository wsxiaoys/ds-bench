# Sequelize Nested Includes and Filtering

## Background
Create an Express REST API using Sequelize and SQLite to manage Companies, Departments, and Employees. The API needs a complex query to fetch companies with deeply nested and filtered associations.

## Requirements
- Define three models: `Company` (string `name`), `Department` (string `name`, string `status`), and `Employee` (string `name`, string `role`).
- Define associations: A Company has many Departments, and a Department has many Employees.
- Implement a RESTful API with the following endpoints:
  - POST `/seed`: Accepts a JSON payload to populate the database. It should clear existing data and insert the provided nested data.
  - GET `/companies/filtered`: Returns all companies. It must include their departments, but ONLY departments where `status` is `'active'`. Within those active departments, it must include employees, but ONLY employees where `role` is `'senior'`. 
  - **CRITICAL**: Companies without any active departments MUST still be included in the response (with an empty departments array). Active departments without any senior employees MUST still be included in the response (with an empty employees array).
- Store data in a SQLite database at `./database.sqlite`.

## Implementation Hints
- Use `Sequelize.sync({ force: true })` during the `/seed` endpoint to reset the database.
- For the nested filtering, use Sequelize's `include` option with `where` clauses.
- Pay close attention to the `required` property in your `include` options. By default, adding a `where` clause to an `include` makes it an INNER JOIN, which would filter out parent records that don't have matching children. You need a LEFT OUTER JOIN.

## Acceptance Criteria
- Project path: /home/user/myproject
- Start command: npm start
- Port: 3000
- API Endpoints:
  - POST `/seed`: Accepts a JSON array of companies with nested departments and employees. Returns status 200 OK after successfully syncing and seeding the database.

    ```json
    // Request
    [
      {
        "name": string,
        "departments": [
          {
            "name": string,
            "status": string,
            "employees": [
              {
                "name": string,
                "role": string
              }
            ]
          }
        ]
      }
    ]
    ```

  - GET `/companies/filtered`: Returns status 200 and a JSON array of company objects. The JSON structure should match the seed payload, but strictly filtered according to the requirements.

