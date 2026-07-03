package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

// Configuration constants for MinIO / S3.
const (
	defaultMinIOEndpoint = "http://127.0.0.1:9000"
	defaultMinIOBucket   = "uploads"
	defaultMinIORegion   = "us-east-1"
	defaultMinIOKey      = "minioadmin"
	defaultMinIOSecret   = "minioadmin"

	// presignTTL is how long the presigned PUT URL stays valid.
	presignTTL = 300 * time.Second

	// pendingCollection / uploadsCollection names.
	pendingCollectionName = "pending_upload"
	uploadsCollectionName = "uploads"
	usersCollectionName   = "users"

	// routePrefix for the custom API endpoints.
	routePrefix = "/api/uploads/"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// newS3Client builds an S3 client pointing at the configured MinIO endpoint
// using path-style addressing (required for local MinIO without DNS).
func newS3Client(ctx context.Context) (*s3.Client, error) {
	endpoint := getenv("MINIO_ENDPOINT", defaultMinIOEndpoint)
	region := getenv("MINIO_REGION", defaultMinIORegion)
	accessKey := getenv("MINIO_ACCESS_KEY", defaultMinIOKey)
	secretKey := getenv("MINIO_SECRET_KEY", defaultMinIOSecret)

	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
		),
		awsconfig.WithBaseEndpoint(endpoint),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	// UsePathStyle is required for local MinIO where there is no DNS bucket hostname.
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})
	return client, nil
}

// generateObjectKey creates a random hex key matching ^[a-f0-9-]{16,}$.
// UUIDv4 hex (no dashes) satisfies the regex, but we keep dashes since the
// regex explicitly allows them.
func generateObjectKey() string {
	return uuid.NewString()
}

// ensureCollection makes sure that the named base collection exists with the
// given fields.  It is idempotent: existing collections are not modified.
func ensureCollection(
	app core.App,
	name string,
	fields func() core.FieldsList,
	indexes func(*core.Collection),
) (*core.Collection, error) {
	existing, _ := app.FindCollectionByNameOrId(name)
	if existing != nil {
		return existing, nil
	}

	coll := core.NewBaseCollection(name)
	coll.Fields = fields()
	if indexes != nil {
		indexes(coll)
	}

	if err := app.Save(coll); err != nil {
		return nil, fmt.Errorf("save collection %q: %w", name, err)
	}

	return coll, nil
}

// bootstrapCollections creates the two custom collections if they don't
// already exist.  Called from the OnBootstrap hook.
func bootstrapCollections(app core.App) error {
	usersCol, err := app.FindCollectionByNameOrId(usersCollectionName)
	if err != nil || usersCol == nil {
		return fmt.Errorf("users collection not found: %w", err)
	}
	usersId := usersCol.Id

	// pending_upload ---------------------------------------------------------
	if _, err := ensureCollection(app, pendingCollectionName, func() core.FieldsList {
		return core.FieldsList{
			&core.RelationField{
				Name:         "user",
				CollectionId: usersId,
				Required:     true,
				MaxSelect:    1,
				MinSelect:    1,
			},
			&core.TextField{
				Name:     "key",
				Required: true,
			},
			&core.DateField{
				Name:     "expires_at",
				Required: true,
			},
		}
	}, func(c *core.Collection) {
		c.AddIndex("idx_pending_upload_key", true, "`key`", "")
	}); err != nil {
		return err
	}

	// uploads ----------------------------------------------------------------
	if _, err := ensureCollection(app, uploadsCollectionName, func() core.FieldsList {
		return core.FieldsList{
			&core.RelationField{
				Name:         "user",
				CollectionId: usersId,
				Required:     true,
				MaxSelect:    1,
				MinSelect:    1,
			},
			&core.TextField{
				Name:     "key",
				Required: true,
			},
		}
	}, func(c *core.Collection) {
		c.AddIndex("idx_uploads_key", true, "`key`", "")
	}); err != nil {
		return err
	}

	return nil
}

// presignResponse is the JSON shape returned by /api/uploads/presign.
type presignResponse struct {
	URL       string `json:"url"`
	Key       string `json:"key"`
	ExpiresAt string `json:"expiresAt"`
}

// finalizeRequest is the JSON body shape accepted by /api/uploads/finalize.
type finalizeRequest struct {
	Key string `json:"key"`
}

// finalizeResponse is the JSON body returned on a successful finalize.
type finalizeResponse struct {
	Key string `json:"key"`
}

// randomHex returns n random hex bytes; used as a fallback if google/uuid is
// not yet loaded (kept for safety even though we use uuid.NewString()).
func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// handlePresign handles POST /api/uploads/presign.
func handlePresign(app core.App, s3Client *s3.Client) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		user := e.Auth
		if user == nil {
			return e.UnauthorizedError("missing auth record", nil)
		}

		pendingCol, err := app.FindCollectionByNameOrId(pendingCollectionName)
		if err != nil || pendingCol == nil {
			return e.InternalServerError("pending_upload collection unavailable", err)
		}

		key := generateObjectKey()
		expiresAt := time.Now().Add(presignTTL).UTC()

		record := core.NewRecord(pendingCol)
		record.Set("user", user.Id)
		record.Set("key", key)
		record.Set("expires_at", expiresAt)

		if err := app.Save(record); err != nil {
			return e.InternalServerError("failed to persist pending_upload", err)
		}

		bucket := getenv("MINIO_BUCKET", defaultMinIOBucket)
		presigner := s3.NewPresignClient(s3Client, func(o *s3.PresignOptions) {
			o.Expires = presignTTL
		})

		putReq, err := presigner.PresignPutObject(context.Background(), &s3.PutObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			return e.InternalServerError("failed to presign PUT url", err)
		}

		return e.JSON(http.StatusOK, presignResponse{
			URL:       putReq.URL,
			Key:       key,
			ExpiresAt: expiresAt.Format(time.RFC3339),
		})
	}
}

// handleFinalize handles POST /api/uploads/finalize.
func handleFinalize(app core.App, s3Client *s3.Client) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		user := e.Auth
		if user == nil {
			return e.UnauthorizedError("missing auth record", nil)
		}

		var body finalizeRequest
		if err := e.BindBody(&body); err != nil {
			return e.BadRequestError("invalid JSON body", err)
		}
		if body.Key == "" {
			return e.BadRequestError("missing key", nil)
		}

		pendingCol, err := app.FindCollectionByNameOrId(pendingCollectionName)
		if err != nil || pendingCol == nil {
			return e.InternalServerError("pending_upload collection unavailable", err)
		}
		uploadsCol, err := app.FindCollectionByNameOrId(uploadsCollectionName)
		if err != nil || uploadsCol == nil {
			return e.InternalServerError("uploads collection unavailable", err)
		}

		// Verify object exists in S3 via HEAD request.
		bucket := getenv("MINIO_BUCKET", defaultMinIOBucket)
		_, err = s3Client.HeadObject(context.Background(), &s3.HeadObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(body.Key),
		})
		if err != nil {
			return e.NotFoundError("object not found in storage", nil)
		}

		// Find the pending_upload row for this key.
		pendingRecord, err := app.FindFirstRecordByFilter(
			pendingCol,
			"key={:key}",
			map[string]any{"key": body.Key},
		)
		if err != nil || pendingRecord == nil {
			return e.NotFoundError("no pending_upload record for key", nil)
		}

		// The pending_upload must belong to the authenticated user.
		if pendingRecord.GetString("user") != user.Id {
			return e.NotFoundError("pending_upload does not belong to user", nil)
		}

		// Delete the pending_upload row.
		if err := app.Delete(pendingRecord); err != nil {
			return e.InternalServerError("failed to delete pending_upload", err)
		}

		// Create the uploads row.
		uploadRecord := core.NewRecord(uploadsCol)
		uploadRecord.Set("user", user.Id)
		uploadRecord.Set("key", body.Key)
		if err := app.Save(uploadRecord); err != nil {
			return e.InternalServerError("failed to persist upload", err)
		}

		return e.JSON(http.StatusOK, finalizeResponse{
			Key: body.Key,
		})
	}
}

func main() {
	app := pocketbase.New()

	// Build the S3 client once at startup; it is safe for concurrent use.
	s3Client, err := newS3Client(context.Background())
	if err != nil {
		log.Fatalf("failed to build s3 client: %v", err)
	}

	// Bootstrap custom collections.
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		return bootstrapCollections(e.App)
	})

	// Register the two custom REST endpoints.
	app.OnServe().Bind(&hook.Handler[*core.ServeEvent]{
		Func: func(e *core.ServeEvent) error {
			auth := apis.RequireAuth(usersCollectionName)

			e.Router.POST(routePrefix+"presign", handlePresign(e.App, s3Client)).
				Bind(auth)

			e.Router.POST(routePrefix+"finalize", handleFinalize(e.App, s3Client)).
				Bind(auth)

			return e.Next()
		},
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}