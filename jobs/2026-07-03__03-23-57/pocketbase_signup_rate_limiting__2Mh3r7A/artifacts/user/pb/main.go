package main

import (
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// IPRateLimiter is a thread-safe sliding-window rate limiter.
type IPRateLimiter struct {
	mu      sync.Mutex
	history map[string][]time.Time
}

func NewIPRateLimiter() *IPRateLimiter {
	rl := &IPRateLimiter{
		history: make(map[string][]time.Time),
	}
	// Start a background cleanup ticker to prevent memory leaks
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		for range ticker.C {
			rl.Cleanup()
		}
	}()
	return rl
}

func (rl *IPRateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	oneMinuteAgo := now.Add(-1 * time.Minute)

	requests, exists := rl.history[ip]
	if !exists {
		rl.history[ip] = []time.Time{now}
		return true
	}

	var activeRequests []time.Time
	for _, t := range requests {
		if t.After(oneMinuteAgo) {
			activeRequests = append(activeRequests, t)
		}
	}

	if len(activeRequests) >= 5 {
		rl.history[ip] = activeRequests
		return false
	}

	activeRequests = append(activeRequests, now)
	rl.history[ip] = activeRequests
	return true
}

func (rl *IPRateLimiter) Cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	oneMinuteAgo := now.Add(-1 * time.Minute)

	for ip, requests := range rl.history {
		var activeRequests []time.Time
		for _, t := range requests {
			if t.After(oneMinuteAgo) {
				activeRequests = append(activeRequests, t)
			}
		}
		if len(activeRequests) == 0 {
			delete(rl.history, ip)
		} else {
			rl.history[ip] = activeRequests
		}
	}
}

type SignupPayload struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"passwordConfirm"`
}

func main() {
	app := pocketbase.New()

	limiter := NewIPRateLimiter()

	// serves static files from the provided public dir (if exists)
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Register custom signup route
		se.Router.POST("/api/custom_signup", func(e *core.RequestEvent) error {
			// Rate limiting check
			ip := e.RealIP()
			if !limiter.Allow(ip) {
				return e.TooManyRequestsError("Too many requests from this IP address", nil)
			}

			// Parse request body
			var payload SignupPayload
			if err := e.BindBody(&payload); err != nil {
				return e.BadRequestError("Invalid request body", err)
			}

			// Validate payload
			if payload.Email == "" {
				return e.BadRequestError("Email is required", nil)
			}
			if payload.Password == "" {
				return e.BadRequestError("Password is required", nil)
			}
			if payload.Password != payload.PasswordConfirm {
				return e.BadRequestError("Passwords do not match", nil)
			}

			// Find users collection
			collection, err := e.App.FindCollectionByNameOrId("users")
			if err != nil {
				return e.InternalServerError("Failed to find users collection", err)
			}

			// Create new record
			record := core.NewRecord(collection)
			record.SetEmail(payload.Email)
			record.SetPassword(payload.Password)

			// Save record
			if err := e.App.Save(record); err != nil {
				return apis.ToApiError(err)
			}

			// Return success response
			return e.JSON(http.StatusCreated, map[string]any{
				"id":    record.Id,
				"email": record.Email(),
			})
		})

		se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
