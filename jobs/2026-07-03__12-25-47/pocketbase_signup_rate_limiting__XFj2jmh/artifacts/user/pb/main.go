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
"github.com/pocketbase/pocketbase/tools/hook"
"golang.org/x/time/rate"
)

// ipLimiter stores a per-IP rate limiter along with the last time it was used.
type ipLimiter struct {
limiter  *rate.Limiter
lastSeen time.Time
}

// rateLimitStore keeps per-IP rate limiters in memory.
type rateLimitStore struct {
sync.Mutex
clients map[string]*ipLimiter
r       rate.Limit
b       int
ttl     time.Duration
}

func newRateLimitStore() *rateLimitStore {
return &rateLimitStore{
clients: make(map[string]*ipLimiter),
// 5 requests per 1 minute: 1 token every 12 seconds, burst 5.
r:       rate.Every(time.Minute / 5),
b:       5,
ttl:     time.Minute,
}
}

func (s *rateLimitStore) getLimiter(ip string) *rate.Limiter {
s.Lock()
defer s.Unlock()

client, ok := s.clients[ip]
if !ok {
limiter := rate.NewLimiter(s.r, s.b)
s.clients[ip] = &ipLimiter{limiter: limiter, lastSeen: time.Now()}
return limiter
}

client.lastSeen = time.Now()
return client.limiter
}

// periodicCleanup removes inactive client entries.
func (s *rateLimitStore) periodicCleanup() {
for range time.Tick(time.Minute) {
s.Lock()
for ip, client := range s.clients {
if time.Since(client.lastSeen) > s.ttl {
delete(s.clients, ip)
}
}
s.Unlock()
}
}

// ipRateLimit returns a middleware that limits requests per IP address.
func ipRateLimit(store *rateLimitStore) *hook.Handler[*core.RequestEvent] {
return &hook.Handler[*core.RequestEvent]{
Id:   "pbIpRateLimit",
Func: func(e *core.RequestEvent) error {
ip := e.RealIP()
if ip == "" {
ip = e.RemoteIP()
}
if !store.getLimiter(ip).Allow() {
return e.Error(http.StatusTooManyRequests, "Too many requests. Please try again later.", nil)
}
return e.Next()
},
}
}

func main() {
app := pocketbase.New()

app.OnServe().BindFunc(func(se *core.ServeEvent) error {
// serves static files from the provided public dir (if exists)
se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), false))

// Rate limit store: 5 requests per minute per IP.
store := newRateLimitStore()
go store.periodicCleanup()

// Register the custom signup route with per-IP rate limiting middleware.
se.Router.POST("/api/custom_signup", customSignup).Bind(ipRateLimit(store))

return se.Next()
})

if err := app.Start(); err != nil {
log.Fatal(err)
}
}

// customSignup handles POST /api/custom_signup.
//
// It accepts a JSON payload with email, password, and passwordConfirm,
// creates a new record in the users collection, and returns 200 OK on success.
func customSignup(e *core.RequestEvent) error {
type signupPayload struct {
Email           string `json:"email"`
Password        string `json:"password"`
PasswordConfirm string `json:"passwordConfirm"`
}

payload := &signupPayload{}
if err := e.BindBody(payload); err != nil {
return e.BadRequestError("Failed to bind request body.", err)
}

if payload.Email == "" || payload.Password == "" || payload.PasswordConfirm == "" {
return e.BadRequestError("email, password and passwordConfirm are required.", nil)
}

if payload.Password != payload.PasswordConfirm {
return e.BadRequestError("Password and passwordConfirm do not match.", nil)
}

collection, err := e.App.FindCollectionByNameOrId("users")
if err != nil {
return e.InternalServerError("Failed to load users collection.", err)
}

record := core.NewRecord(collection)
record.Set("email", payload.Email)
record.Set("password", payload.Password)
record.Set("passwordConfirm", payload.PasswordConfirm)

if err := e.App.Save(record); err != nil {
return e.BadRequestError("Failed to create user.", err)
}

return e.JSON(http.StatusOK, map[string]any{
"id":    record.Id,
"email": record.Get("email"),
})
}
