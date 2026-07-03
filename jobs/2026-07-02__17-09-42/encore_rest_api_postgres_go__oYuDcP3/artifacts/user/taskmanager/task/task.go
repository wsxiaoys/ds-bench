package task

import (
	"context"
	"errors"

	"encore.dev/beta/errs"
	"encore.dev/storage/sqldb"
)

// taskdb is a PostgreSQL database used by this service.
//
// Encore provisions, migrates, and connects to the database REDACTEDmatically.
var db = sqldb.NewDatabase("taskdb", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Task represents a single to-do item.
type Task struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// CreateTaskParams is the request body for creating a new task.
type CreateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// UpdateTaskParams is the request body for updating an existing task.
type UpdateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// ListTasksResponse is the response body for listing all tasks.
type ListTasksResponse struct {
	Tasks []*Task `json:"tasks"`
}

// CreateTask creates a new task.
//
//encore:api public path=/tasks method=POST
func CreateTask(ctx context.Context, params *CreateTaskParams) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx,
		`INSERT INTO tasks (title, description, done) VALUES ($1, $2, FALSE)
		 RETURNING id, title, description, done`,
		params.Title, params.Description,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTasks lists all tasks.
//
//encore:api public path=/tasks method=GET
func ListTasks(ctx context.Context) (*ListTasksResponse, error) {
	rows, err := db.Query(ctx,
		`SELECT id, title, description, done FROM tasks ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := []*Task{}
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Done); err != nil {
			return nil, err
		}
		tasks = append(tasks, &t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &ListTasksResponse{Tasks: tasks}, nil
}

// GetTask returns a single task by ID.
//
//encore:api public path=/tasks/:id method=GET
func GetTask(ctx context.Context, id int) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx,
		`SELECT id, title, description, done FROM tasks WHERE id = $1`, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		if errors.Is(err, sqldb.ErrNoRows) {
			return nil, &errs.Error{
				Code:    errs.NotFound,
				Message: "task not found",
			}
		}
		return nil, err
	}
	return &t, nil
}

// UpdateTask updates the title, description, and done status of a task.
//
//encore:api public path=/tasks/:id method=PUT
func UpdateTask(ctx context.Context, id int, params *UpdateTaskParams) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx,
		`UPDATE tasks SET title = $1, description = $2, done = $3
		 WHERE id = $4
		 RETURNING id, title, description, done`,
		params.Title, params.Description, params.Done, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		if errors.Is(err, sqldb.ErrNoRows) {
			return nil, &errs.Error{
				Code:    errs.NotFound,
				Message: "task not found",
			}
		}
		return nil, err
	}
	return &t, nil
}

// DeleteTask deletes a task by ID.
//
//encore:api public path=/tasks/:id method=DELETE
func DeleteTask(ctx context.Context, id int) error {
	_, err := db.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	return err
}
