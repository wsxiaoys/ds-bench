package main

import (
"context"
"database/sql"
"errors"
"fmt"
"log"
"os"
"strings"
"time"

"github.com/aws/aws-sdk-go-v2/aws"
awsconfig "github.com/aws/aws-sdk-go-v2/config"
"github.com/aws/aws-sdk-go-v2/credentials"
"github.com/aws/aws-sdk-go-v2/service/s3"
"github.com/aws/smithy-go"
	"github.com/pocketbase/dbx"
"github.com/google/uuid"
"github.com/pocketbase/pocketbase"
"github.com/pocketbase/pocketbase/apis"
"github.com/pocketbase/pocketbase/core"
"github.com/pocketbase/pocketbase/tools/dbutils"
	"github.com/pocketbase/pocketbase/tools/hook"
)

const (
defaultEndpoint  = "http://127.0.0.1:9000"
defaultRegion    = "us-east-1"
defaultBucket    = "uploads"
defaultAccessKey = "minioadmin"
defaultSecretKey = "minioadmin"
presignExpires   = 5 * time.Minute
)

func envOr(key, def string) string {
if v := os.Getenv(key); v != "" {
return v
}
return def
}

type s3Config struct {
Endpoint  string
Region    string
Bucket    string
AccessKey string
SecretKey string
}

func loadS3Config() s3Config {
return s3Config{
Endpoint:  envOr("MINIO_ENDPOINT", defaultEndpoint),
Region:    envOr("MINIO_REGION", defaultRegion),
Bucket:    envOr("MINIO_BUCKET", defaultBucket),
AccessKey: envOr("MINIO_ACCESS_KEY", defaultAccessKey),
SecretKey: envOr("MINIO_SECRET_KEY", defaultSecretKey),
}
}

func ensureScheme(endpoint string) string {
if strings.HasPrefix(endpoint, "http://") || strings.HasPrefix(endpoint, "https://") {
return endpoint
}
return "http://" + endpoint
}

func newS3Client(ctx context.Context, cfg s3Config) (*s3.Client, error) {
endpoint := ensureScheme(cfg.Endpoint)

awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
awsconfig.WithRegion(cfg.Region),
awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
)
if err != nil {
return nil, err
}

return s3.NewFromConfig(awsCfg, func(o *s3.Options) {
o.BaseEndpoint = aws.String(endpoint)
o.UsePathStyle = true
}), nil
}

func findAuthCollectionId(app core.App) (string, error) {
// try users first, then _pb_users_auth_, then any auth collection
for _, name := range []string{"users", "_pb_users_auth_"} {
if col, err := app.Dao().FindCollectionByNameOrId(name); err == nil {
return col.Id, nil
}
}
// fallback: find any auth collection
cols, err := app.Dao().FindCollectionsByType(core.CollectionTypeAuth)
if err != nil {
return "", err
}
if len(cols) > 0 {
return cols[0].Id, nil
}
return "", errors.New("no auth collection found")
}

func ensureCollection(app core.App, name string, fields func(col *core.Collection), indexes []string) error {
col, err := app.Dao().FindCollectionByNameOrId(name)
if err != nil {
if !errors.Is(err, sql.ErrNoRows) {
return fmt.Errorf("find %s: %w", name, err)
}
col = core.NewBaseCollection(name)
col.Fields.Add() // ensure initialized
fields(col)
col.Indexes = append(col.Indexes, indexes...)
if err := app.Dao().SaveCollection(col); err != nil {
return fmt.Errorf("save %s: %w", name, err)
}
log.Printf("created collection %s", name)
return nil
}

// existing collection - ensure indexes are present
changed := false
for _, idx := range indexes {
name := dbutils.ParseIndex(idx).IndexName
found := false
for _, existing := range col.Indexes {
if strings.EqualFold(dbutils.ParseIndex(existing).IndexName, name) {
found = true
break
}
}
if !found {
col.Indexes = append(col.Indexes, idx)
changed = true
}
}
if changed {
if err := app.Dao().SaveCollection(col); err != nil {
return fmt.Errorf("update %s indexes: %w", name, err)
}
}
return nil
}

func ensureCollections(app core.App) error {
authColId, err := findAuthCollectionId(app)
if err != nil {
return err
}

if err := ensureCollection(app, "pending_upload", func(col *core.Collection) {
col.Fields.Add(
&core.RelationField{
Name:     "user",
Required: true,
MaxSelect: 1,
CollectionId: authColId,
},
&core.TextField{
Name:     "key",
Required: true,
Pattern:  "^[a-f0-9-]{16,}$",
},
&core.DateField{
Name:     "expires_at",
Required: true,
},
)
}, []string{
"CREATE UNIQUE INDEX idx_pending_upload_key ON pending_upload ([[key]])",
}); err != nil {
return err
}

if err := ensureCollection(app, "uploads", func(col *core.Collection) {
col.Fields.Add(
&core.RelationField{
Name:     "user",
Required: true,
MaxSelect: 1,
CollectionId: authColId,
},
&core.TextField{
Name:     "key",
Required: true,
Pattern:  "^[a-f0-9-]{16,}$",
},
)
}, []string{
"CREATE UNIQUE INDEX idx_uploads_key ON uploads ([[key]])",
}); err != nil {
return err
}

return nil
}

func handlePresign(app core.App, s3Client *s3.Client) func(e *core.RequestEvent) error {
presign := s3.NewPresignClient(s3Client)
cfg := loadS3Config()

return func(e *core.RequestEvent) error {
rec := e.Auth
if rec == nil {
return e.UnauthorizedError("unauthorized", nil)
}

key := uuid.New().String()
expiresAt := time.Now().Add(presignExpires).UTC()

pendingCol, err := app.Dao().FindCollectionByNameOrId("pending_upload")
if err != nil {
return e.InternalServerError("", err)
}

row := core.NewRecord(pendingCol)
row.Set("user", rec.Id)
row.Set("key", key)
row.Set("expires_at", expiresAt)
if err := app.Dao().SaveRecord(row); err != nil {
return e.InternalServerError("", err)
}

req, err := presign.PresignPutObject(context.Background(), &s3.PutObjectInput{
Bucket: aws.String(cfg.Bucket),
Key:    aws.String(key),
}, func(o *s3.PresignOptions) {
o.Expires = presignExpires
})
if err != nil {
return e.InternalServerError("", err)
}

return e.JSON(200, map[string]any{
"url":       req.URL,
"key":       key,
"expiresAt": expiresAt.Format(time.RFC3339),
})
}
}

type finalizeRequest struct {
Key string `json:"key"`
}

func handleFinalize(app core.App, s3Client *s3.Client) func(e *core.RequestEvent) error {
cfg := loadS3Config()

return func(e *core.RequestEvent) error {
rec := e.Auth
if rec == nil {
return e.UnauthorizedError("unauthorized", nil)
}

var body finalizeRequest
if err := e.BindBody(&body); err != nil {
return e.BadRequestError("invalid body", err)
}
key := strings.TrimSpace(body.Key)
if key == "" {
return e.BadRequestError("missing key", nil)
}

pendingCol, err := app.Dao().FindCollectionByNameOrId("pending_upload")
if err != nil {
return e.InternalServerError("", err)
}

pending, err := app.Dao().FindFirstRecordByFilter(pendingCol, "[[key]] = {:key}", dbx.Params{"key": key})
if err != nil {
return e.NotFoundError("", err)
}
userId, _ := pending.Get("user").(string)
if userId == "" || userId != rec.Id {
return e.NotFoundError("", nil)
}

// HEAD request to verify object exists
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
_, headErr := s3Client.HeadObject(ctx, &s3.HeadObjectInput{
Bucket: aws.String(cfg.Bucket),
Key:    aws.String(key),
})
if headErr != nil {
var apiErr smithy.APIError
if errors.As(headErr, &apiErr) {
if apiErr.ErrorCode() == "NotFound" || apiErr.ErrorCode() == "NoSuchKey" {
return e.NotFoundError("", headErr)
}
}
return e.NotFoundError("", headErr)
}

if err := app.Dao().DeleteRecord(pending); err != nil {
return e.InternalServerError("", err)
}

uploadsCol, err := app.Dao().FindCollectionByNameOrId("uploads")
if err != nil {
return e.InternalServerError("", err)
}

newRec := core.NewRecord(uploadsCol)
newRec.Set("user", rec.Id)
newRec.Set("key", key)
if err := app.Dao().SaveRecord(newRec); err != nil {
return e.InternalServerError("", err)
}

return e.JSON(200, map[string]any{
"key": key,
})
}
}

func main() {
app := pocketbase.New()

app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
Func: func(e *core.ServeEvent) error {
if err := ensureCollections(e.App); err != nil {
return err
}
cfg := loadS3Config()
s3Client, err := newS3Client(context.Background(), cfg)
if err != nil {
return err
}

auth := apis.RequireAuth("users")

e.Router.POST("/api/uploads/presign", auth, handlePresign(e.App, s3Client))
e.Router.POST("/api/uploads/finalize", auth, handleFinalize(e.App, s3Client))
return e.Next()
},
})

if err := app.Start(); err != nil {
log.Fatal(err)
}
}
