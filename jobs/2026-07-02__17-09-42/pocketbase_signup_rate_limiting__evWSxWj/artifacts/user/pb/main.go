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
	"github.com/pocketbase/pocketbase/forms"
	"github.com/pocketbase/pocketbase/tools/hook"
	"golang.org/x/time/rate"
)

// ipRateLimiter is a thread-safe registry of per-IP rate limiters.
//
// Each IP address gets its own *rate.Limiter instance on first use, lazily
// created and stored in the map. The limiter itself is created with the
// shared rate.Limit and burst parameters, meaning that every IP has the
// same global quota.
type ipRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
	r        rate.Limit
	b        int
}

// newIPRateLimiter creates a new IP-based rate limiter store.
//
// 5 requests per 1 minute is implemented as a token bucket that refills
// 1 token every 12 seconds (rate.Every) with a burst capacity of 5. This
// means a client can make 5 requests immediately and must then wait
// roughly 12s per additional request - the 6th request inside a 1-minute
// window will be denied.
func newIPRateLimiter(r rate.Limit, b int) *ipRateLimiter {
	return &ipRateLimiter{
		limiters: make(map[string]*rate.Limiter),
		r:        r,
		b:        b,
	}
}

// limiterFor returns the rate.Limiter associated with the given IP,
// creating one on first use.
func (i *ipRateLimiter) limiterFor(ip string) *rate.Limiter {
	i.mu.Lock()
	defer i.mu.Unlock()

	lim, ok := i.limiters[ip]
	if !ok {
		lim = rate.NewLimiter(i.r, i.b)
		i.limiters[ip] = lim
	}

	return lim
}

// customSignupRateLimit returns a PocketBase middleware that rate-limits
// requests on a per-IP basis using the provided ipRateLimiter.
//
// On rate limit exhaustion it returns a 429 Too Many Requests response.
func customSignupRateLimit(irl *ipRateLimiter) *hook.Handler[*core.RequestEvent] {
	return &hook.Handler[*core.RequestEvent]{
		Id: "pbCustomSignupRateLimit",
		Func: func(e *core.RequestEvent) error {
			ip := e.RealIP()
			if ip == "" {
				ip = e.RemoteIP()
			}

			if ip == "" {
				// without an IP we cannot enforce the rate limit, so let it pass
				return e.Next()
			}

			if !irl.limiterFor(ip).Allow() {
				return e.TooManyRequestsError(
					"Too many signup requests. Please try again later.",
					nil,
				)
			}

			return e.Next()
		},
	}
}

// customSignupForm is the JSON payload expected by the custom signup route.
type customSignupForm struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"passwordConfirm"`
}

// customSignup returns a handler that creates a new record in the
// "users" auth collection and returns 201 Created on success.
func customSignup(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		form := &customSignupForm{}
		if err := e.BindBody(form); err != nil {
			return e.BadRequestError("Failed to read the submitted data.", err)
		}

		if form.Email == "" || form.Password == "" || form.PasswordConfirm == "" {
			return e.BadRequestError(
				"email, password and passwordConfirm are required.",
				nil,
			)
		}

		if form.Password != form.PasswordConfirm {
			return e.BadRequestError("Passwords do not match.", nil)
		}

		collection, err := app.FindCachedCollectionByNameOrId("users")
		if err != nil || collection == nil {
			return e.NotFoundError("Missing users collection.", err)
		}

		// create a new auth record for the users collection
		record := core.NewRecord(collection)

		// use the RecordUpsert form so that the auth/password fields are
		// properly validated and hashed (matches the built-in /api/collections/.../records flow)
		upsert := forms.NewRecordUpsert(app, record)
		upsert.Load(map[string]any{
			"email":           form.Email,
			"password":        form.Password,
			"passwordConfirm": form.PasswordConfirm,
		})

		if err := upsert.Submit(); err != nil {
			return e.BadRequestError("Failed to create record.", err)
		}

		// enrich the record (expand relations, file fields, etc.) before returning
		if err := apis.EnrichRecord(e, record); err != nil {
			return e.InternalServerError("Failed to enrich record.", err)
		}

		return e.JSON(http.StatusCreated, record)
	}
}

func main() {
	app := pocketbase.New()

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// static files (existing behavior)
		se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))

		// per-IP rate limiter: 5 requests per minute (token every 12s, burst 5)
		irl := newIPRateLimiter(rate.Every(12*time.Second), 5)

		// custom signup route protected by the rate limit middleware
		se.Router.POST("/api/custom_signup", customSignup(se.App)).
			Bind(customSignupRateLimit(irl))

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
