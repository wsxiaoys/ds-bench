package task

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"encore.dev/storage/sqldb"
)

// Task represents a to-do item.
type Task struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// CreateTaskParams defines the inputs for creating a task.
type CreateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// UpdateTaskParams defines the inputs for updating a task.
type UpdateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// ListTasksResponse defines the output for listing tasks.
type ListTasksResponse struct {
	Tasks []*Task `json:"tasks"`
}

// Define the database.
var taskdb = sqldb.NewDatabase("taskdb", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Create a new task.
//
//encore:api public method=POST path=/tasks
func CreateTask(ctx context.Context, params *CreateTaskParams) (*Task, error) {
	var t Task
	err := taskdb.QueryRow(ctx, `
		INSERT INTO tasks (title, description, done)
		VALUES ($1, $2, FALSE)
		RETURNING id, title, description, done
	`, params.Title, params.Description).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// List all tasks.
//
//encore:api public method=GET path=/tasks
func ListTasks(ctx context.Context) (*ListTasksResponse, error) {
	rows, err := taskdb.Query(ctx, "SELECT id, title, description, done FROM tasks")
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

// Get a single task by ID.
//
//encore:api public method=GET path=/tasks/:id
func GetTask(ctx context.Context, id int) (*Task, error) {
	var t Task
	err := taskdb.QueryRow(ctx, "SELECT id, title, description, done FROM tasks WHERE id = $1", id).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("task not found: %d", id)
	} else if err != nil {
		return nil, err
	}
	return &t, nil
}

// Update a task.
//
//encore:api public method=PUT path=/tasks/:id
func UpdateTask(ctx context.Context, id int, params *UpdateTaskParams) (*Task, error) {
	var t Task
	err := taskdb.QueryRow(ctx, `
		UPDATE tasks
		SET title = $1, description = $2, done = $3
		WHERE id = $4
		RETURNING id, title, description, done
	`, params.Title, params.Description, params.Done, id).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("task not found: %d", id)
	} else if err != nil {
		return nil, err
	}
	return &t, nil
}

// Delete a task.
//
//encore:api public method=DELETE path=/tasks/:id
func DeleteTask(ctx context.Context, id int) error {
	_, err := taskdb.Exec(ctx, "DELETE FROM tasks WHERE id = $1", id)
	return err
}
