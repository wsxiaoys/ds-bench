package task

import (
	"context"
	"database/sql"

	"encore.dev/errs"
	"encore.dev/storage/sqldb"
)

//encore:service

type Service struct{}

var taskdb = sqldb.NewDatabase("taskdb", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

type Task struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

type CreateTaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type UpdateTaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

type ListTasksResponse struct {
	Tasks []Task `json:"tasks"`
}

//encore:api public method=POST path=/tasks
func CreateTask(ctx context.Context, req *CreateTaskRequest) (*Task, error) {
	row := taskdb.QueryRow(ctx,
		"INSERT INTO tasks (title, description, done) VALUES ($1, $2, false) RETURNING id, title, description, done",
		req.Title,
		req.Description,
	)

	var task Task
	if err := row.Scan(&task.ID, &task.Title, &task.Description, &task.Done); err != nil {
		return nil, err
	}

	return &task, nil
}

//encore:api public method=GET path=/tasks
func ListTasks(ctx context.Context) (*ListTasksResponse, error) {
	rows, err := taskdb.Query(ctx, "SELECT id, title, description, done FROM tasks ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]Task, 0)
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
func GetTask(ctx context.Context, id int64) (*Task, error) {
	var task Task
	row := taskdb.QueryRow(ctx, "SELECT id, title, description, done FROM tasks WHERE id = $1", id)
	if err := row.Scan(&task.ID, &task.Title, &task.Description, &task.Done); err != nil {
		if err == sql.ErrNoRows {
			return nil, errs.NotFound("task", "task not found")
		}
		return nil, err
	}

	return &task, nil
}

//encore:api public method=PUT path=/tasks/:id
func UpdateTask(ctx context.Context, id int64, req *UpdateTaskRequest) (*Task, error) {
	var task Task
	row := taskdb.QueryRow(ctx,
		"UPDATE tasks SET title = $1, description = $2, done = $3 WHERE id = $4 RETURNING id, title, description, done",
		req.Title,
		req.Description,
		req.Done,
		id,
	)
	if err := row.Scan(&task.ID, &task.Title, &task.Description, &task.Done); err != nil {
		if err == sql.ErrNoRows {
			return nil, errs.NotFound("task", "task not found")
		}
		return nil, err
	}

	return &task, nil
}

//encore:api public method=DELETE path=/tasks/:id
func DeleteTask(ctx context.Context, id int64) error {
	result, err := taskdb.Exec(ctx, "DELETE FROM tasks WHERE id = $1", id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errs.NotFound("task", "task not found")
	}

	return nil
}
