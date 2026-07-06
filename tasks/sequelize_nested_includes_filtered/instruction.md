# Sequelize Nested Includes and Filtering

## Background
Create an Express REST API using Sequelize and SQLite to manage Companies, Departments, and Employees. The API needs a complex query to fetch companies with deeply nested and filtered associations.

## Requirements
- The project must be located at `/home/user/myproject`.
- The Express application must listen on port `3000` and start via `npm start`.
- Define three models: `Company` (string `name`), `Department` (string `name`, string `status`), and `Employee` (string `name`, string `role`).
- Define associations: A Company has many Departments, and a Department has many Employees.
- Store data in a SQLite database at `./database.sqlite`.
- Implement a RESTful API with the following endpoints:
  - POST `/seed`: Accepts a JSON payload to populate the database. It should clear existing data and insert the provided nested data. It must return status 200 OK after successfully syncing and seeding the database. The seed payload is a JSON array of companies with nested departments and employees of the following structure:
    ```json
    [
      {
        "name": "TechCorp",
        "departments": [
          {
            "name": "Engineering",
            "status": "active",
            "employees": [
              {
                "name": "Alice",
                "role": "senior"
              }
            ]
          }
        ]
      }
    ]
    ```
  - GET `/companies/filtered`: Returns status 200 OK and a JSON array of company objects. The JSON structure should match the seed payload, but strictly filtered according to the requirements. It must return all companies. It must include their departments, but ONLY departments where `status` is `'active'`. Within those active departments, it must include employees, but ONLY employees where `role` is `'senior'`.
  - **CRITICAL**: Companies without any active departments MUST still be included in the response (with an empty departments array). Active departments without any senior employees MUST still be included in the response (with an empty employees array).

## Implementation Hints
- Use `Sequelize.sync({ force: true })` during the `/seed` endpoint to reset the database.
- For the nested filtering, use Sequelize's `include` option with `where` clauses.
- Pay close attention to the `required` property in your `include` options. By default, adding a `where` clause to an `include` makes it an INNER JOIN, which would filter out parent records that don't have matching children. You need a LEFT OUTER JOIN.

