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

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

// ipBucket tracks the number of requests made from a single IP within the
// current rolling window.
type ipBucket struct {
	count     int
	expiresAt time.Time
}

// rateLimiter is a simple in-memory, fixed-window rate limiter keyed by IP
// address. It allows at most `max` requests every `window` per IP.
//
// It is intentionally implemented with only the standard library so the
// project has no extra external dependencies.
type rateLimiter struct {
	mu      sync.Mutex
	clients map[string]*ipBucket
	max     int
	window  time.Duration
}

// newRateLimiter creates a new rateLimiter allowing `max` requests per `window`.
func newRateLimiter(max int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		clients: map[string]*ipBucket{},
		max:     max,
		window:  window,
	}

	// periodically remove expired buckets so the map doesn't grow forever
	go func() {
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		for range ticker.C {
			rl.cleanup()
		}
	}()

	return rl
}

// allow reports whether a request coming from `ip` is allowed under the
// configured limit. When the limit is exceeded it returns false.
func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	bucket, ok := rl.clients[ip]
	if !ok || now.After(bucket.expiresAt) {
		bucket = &ipBucket{
			count:     0,
			expiresAt: now.Add(rl.window),
		}
		rl.clients[ip] = bucket
	}

	if bucket.count >= rl.max {
		return false
	}

	bucket.count++
	return true
}

// cleanup removes all buckets whose window has already expired.
func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for ip, bucket := range rl.clients {
		if now.After(bucket.expiresAt) {
			delete(rl.clients, ip)
		}
	}
}

// ---------------------------------------------------------------------------
// Signup payload
// ---------------------------------------------------------------------------

type signupPayload struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"passwordConfirm"`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

func main() {
	app := pocketbase.New()

	// 5 requests per 1 minute per IP for the custom signup route.
	signupLimiter := newRateLimiter(5, time.Minute)

	// serves static files from the provided public dir (if exists)
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))

		// POST /api/custom_signup
		//
		// Creates a new record in the "users" collection and is protected
		// by a per-IP rate limit (max 5 requests / minute).
		se.Router.POST("/api/custom_signup", func(e *core.RequestEvent) error {
			payload := &signupPayload{}
			if err := e.BindBody(payload); err != nil {
				return e.BadRequestError("Invalid request body", err)
			}

			if payload.Email == "" || payload.Password == "" || payload.PasswordConfirm == "" {
				return e.BadRequestError("email, password and passwordConfirm are required", nil)
			}

			if payload.Password != payload.PasswordConfirm {
				return e.BadRequestError("password and passwordConfirm do not match", nil)
			}

			usersCol, err := e.App.FindCachedCollectionByNameOrId("users")
			if err != nil {
				return e.InternalServerError("Missing or invalid \"users\" collection", err)
			}

			record := core.NewRecord(usersCol)
			record.SetEmail(payload.Email)
			record.SetPassword(payload.Password)

			if err := e.App.Save(record); err != nil {
				return e.BadRequestError("Failed to create user", err)
			}

			return e.JSON(http.StatusCreated, map[string]any{
				"success": true,
				"record":  record,
			})
		}).BindFunc(func(e *core.RequestEvent) error {
			// rate limit middleware
			ip := e.RealIP()
			if ip == "" {
				ip = e.RemoteIP()
			}
			if !signupLimiter.allow(ip) {
				return e.TooManyRequestsError("Rate limit exceeded: max 5 requests per minute per IP", nil)
			}
			return e.Next()
		})

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}