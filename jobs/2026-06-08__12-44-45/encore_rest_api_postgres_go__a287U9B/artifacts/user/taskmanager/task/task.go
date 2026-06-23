package task

import (
	"context"
	"encore.dev/storage/sqldb"
)

// taskdb is the PostgreSQL database for the task service.
var taskdb = sqldb.NewDatabase("taskdb", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

// Task represents a to-do task.
type Task struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// CreateTaskParams are the parameters for creating a task.
type CreateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// UpdateTaskParams are the parameters for updating a task.
type UpdateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

// ListTasksResponse is the response for listing tasks.
type ListTasksResponse struct {
	Tasks []*Task `json:"tasks"`
}

// CreateTask creates a new task.
//
// encore:api public method=POST path=/tasks
func CreateTask(ctx context.Context, params *CreateTaskParams) (*Task, error) {
	t := &Task{}
	err := taskdb.QueryRow(ctx,
		`INSERT INTO tasks (title, description, done)
		 VALUES ($1, $2, false)
		 RETURNING id, title, description, done`,
		params.Title, params.Description,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// ListTasks returns all tasks.
//
// encore:api public method=GET path=/tasks
func ListTasks(ctx context.Context) (*ListTasksResponse, error) {
	rows, err := taskdb.Query(ctx,
		`SELECT id, title, description, done FROM tasks ORDER BY id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*Task
	for rows.Next() {
		t := &Task{}
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Done); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if tasks == nil {
		tasks = []*Task{}
	}
	return &ListTasksResponse{Tasks: tasks}, nil
}

// GetTask returns a single task by its ID.
//
// encore:api public method=GET path=/tasks/:id
func GetTask(ctx context.Context, id int) (*Task, error) {
	t := &Task{}
	err := taskdb.QueryRow(ctx,
		`SELECT id, title, description, done FROM tasks WHERE id = $1`,
		id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// UpdateTask updates a task by its ID.
//
// encore:api public method=PUT path=/tasks/:id
func UpdateTask(ctx context.Context, id int, params *UpdateTaskParams) (*Task, error) {
	t := &Task{}
	err := taskdb.QueryRow(ctx,
		`UPDATE tasks
		 SET title = $1, description = $2, done = $3
		 WHERE id = $4
		 RETURNING id, title, description, done`,
		params.Title, params.Description, params.Done, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// DeleteTaskResponse is the response for deleting a task.
type DeleteTaskResponse struct{}

// DeleteTask deletes a task by its ID.
//
// encore:api public method=DELETE path=/tasks/:id
func DeleteTask(ctx context.Context, id int) (*DeleteTaskResponse, error) {
	_, err := taskdb.Exec(ctx,
		`DELETE FROM tasks WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &DeleteTaskResponse{}, nil
}
