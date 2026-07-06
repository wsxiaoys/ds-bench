package task

import (
	"context"
	"errors"

	"encore.dev/beta/errs"
	"encore.dev/storage/sqldb"
)

// Define the database "taskdb"
var db = sqldb.NewDatabase("taskdb", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Task represents a task/to-do item.
type Task struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// CreateTaskParams represents the parameters for creating a task.
type CreateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// CreateTask creates a new task.
//encore:api public method=POST path=/tasks
func CreateTask(ctx context.Context, params *CreateTaskParams) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx, `
		INSERT INTO tasks (title, description, done)
		VALUES ($1, $2, FALSE)
		RETURNING id, title, description, done
	`, params.Title, params.Description).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ListTasksResponse represents the response for listing tasks.
type ListTasksResponse struct {
	Tasks []*Task `json:"tasks"`
}

// ListTasks lists all tasks.
//encore:api public method=GET path=/tasks
func ListTasks(ctx context.Context) (*ListTasksResponse, error) {
	rows, err := db.Query(ctx, `
		SELECT id, title, description, done FROM tasks
		ORDER BY id ASC
	`)
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

	return &ListTasksResponse{Tasks: tasks}, nil
}

// GetTask gets a single task by its ID.
//encore:api public method=GET path=/tasks/:id
func GetTask(ctx context.Context, id int) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx, `
		SELECT id, title, description, done FROM tasks
		WHERE id = $1
	`, id).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
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

// UpdateTaskParams represents the parameters for updating a task.
type UpdateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// UpdateTask updates an existing task.
//encore:api public method=PUT path=/tasks/:id
func UpdateTask(ctx context.Context, id int, params *UpdateTaskParams) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx, `
		UPDATE tasks
		SET title = $1, description = $2, done = $3
		WHERE id = $4
		RETURNING id, title, description, done
	`, params.Title, params.Description, params.Done, id).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
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

// DeleteTask deletes a task by its ID.
//encore:api public method=DELETE path=/tasks/:id
func DeleteTask(ctx context.Context, id int) error {
	res, err := db.Exec(ctx, `
		DELETE FROM tasks
		WHERE id = $1
	`, id)
	if err != nil {
		return err
	}
	rowsAffected := res.RowsAffected()
	if rowsAffected == 0 {
		return &errs.Error{
			Code:    errs.NotFound,
			Message: "task not found",
		}
	}
	return nil
}
