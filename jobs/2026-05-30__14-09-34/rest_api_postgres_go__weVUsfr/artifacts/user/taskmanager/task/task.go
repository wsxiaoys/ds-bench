package task

import (
	"context"

	"encore.dev/storage/sqldb"
)

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

//encore:api public method=POST path=/tasks
func CreateTask(ctx context.Context, p *CreateTaskParams) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx, `
		INSERT INTO tasks (title, description, done)
		VALUES ($1, $2, false)
		RETURNING id, title, description, done
	`, p.Title, p.Description).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

type ListTasksResponse struct {
	Tasks []Task `json:"tasks"`
}

//encore:api public method=GET path=/tasks
func ListTasks(ctx context.Context) (*ListTasksResponse, error) {
	rows, err := db.Query(ctx, "SELECT id, title, description, done FROM tasks")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Done); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	if tasks == nil {
		tasks = []Task{}
	}

	return &ListTasksResponse{Tasks: tasks}, nil
}

//encore:api public method=GET path=/tasks/:id
func GetTask(ctx context.Context, id int) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx, `
		SELECT id, title, description, done FROM tasks WHERE id = $1
	`, id).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

type UpdateTaskParams struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Done        bool   `json:"done"`
}

//encore:api public method=PUT path=/tasks/:id
func UpdateTask(ctx context.Context, id int, p *UpdateTaskParams) (*Task, error) {
	var t Task
	err := db.QueryRow(ctx, `
		UPDATE tasks
		SET title = $1, description = $2, done = $3
		WHERE id = $4
		RETURNING id, title, description, done
	`, p.Title, p.Description, p.Done, id).Scan(&t.ID, &t.Title, &t.Description, &t.Done)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

//encore:api public method=DELETE path=/tasks/:id
func DeleteTask(ctx context.Context, id int) error {
	_, err := db.Exec(ctx, "DELETE FROM tasks WHERE id = $1", id)
	return err
}
