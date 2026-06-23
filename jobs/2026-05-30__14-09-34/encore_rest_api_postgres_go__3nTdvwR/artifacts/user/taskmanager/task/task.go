package task

import (
	"context"

	"encore.dev/storage/sqldb"
)

// Create the task database
var db = sqldb.NewDatabase("taskdb", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

type Task struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

type CreateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type ListTasksResponse struct {
	Tasks []Task `json:"tasks"`
}

type UpdateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

//encore:api public method=POST path=/tasks
func CreateTask(ctx context.Context, params *CreateTaskParams) (*Task, error) {
	var task Task
	err := db.QueryRow(ctx,
		`INSERT INTO tasks (title, description, done) VALUES ($1, $2, FALSE) RETURNING id, title, description, done`,
		params.Title, params.Description,
	).Scan(&task.ID, &task.Title, &task.Description, &task.Done)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

//encore:api public method=GET path=/tasks
func ListTasks(ctx context.Context) (*ListTasksResponse, error) {
	rows, err := db.Query(ctx, `SELECT id, title, description, done FROM tasks ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := []Task{}
	for rows.Next() {
		var task Task
		if err := rows.Scan(&task.ID, &task.Title, &task.Description, &task.Done); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &ListTasksResponse{Tasks: tasks}, nil
}

//encore:api public method=GET path=/tasks/:id
func GetTask(ctx context.Context, id int) (*Task, error) {
	var task Task
	err := db.QueryRow(ctx,
		`SELECT id, title, description, done FROM tasks WHERE id = $1`,
		id,
	).Scan(&task.ID, &task.Title, &task.Description, &task.Done)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

//encore:api public method=PUT path=/tasks/:id
func UpdateTask(ctx context.Context, id int, params *UpdateTaskParams) (*Task, error) {
	var task Task
	err := db.QueryRow(ctx,
		`UPDATE tasks SET title = $2, description = $3, done = $4 WHERE id = $1 RETURNING id, title, description, done`,
		id, params.Title, params.Description, params.Done,
	).Scan(&task.ID, &task.Title, &task.Description, &task.Done)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

//encore:api public method=DELETE path=/tasks/:id
func DeleteTask(ctx context.Context, id int) error {
	_, err := db.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	return err
}