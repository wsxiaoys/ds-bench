package hello

import (
	"context"
	"testing"
)

func TestHello(t *testing.T) {
	resp, err := Hello(context.Background(), "Pochi")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Message != "Hello, Pochi!" {
		t.Errorf("expected 'Hello, Pochi!', got '%s'", resp.Message)
	}
}

func TestPing(t *testing.T) {
	resp, err := Ping(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Message != "pong" {
		t.Errorf("expected 'pong', got '%s'", resp.Message)
	}
}
