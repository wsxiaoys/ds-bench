package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	"github.com/google/uuid"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func isS3NotFoundError(err error) bool {
	if err == nil {
		return false
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		if apiErr.ErrorCode() == "NotFound" || apiErr.ErrorCode() == "NoSuchKey" {
			return true
		}
	}
	var responseError *awshttp.ResponseError
	if errors.As(err, &responseError) {
		if responseError.ResponseError != nil && responseError.ResponseError.HTTPStatusCode() == http.StatusNotFound {
			return true
		}
	}
	errStr := err.Error()
	if strings.Contains(errStr, "status code: 404") || strings.Contains(errStr, "NotFound") || strings.Contains(errStr, "NoSuchKey") {
		return true
	}
	return false
}

func ensureCollectionsExist(app core.App) error {
	usersCollection, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}

	// 1. Check/create pending_upload
	_, err = app.FindCollectionByNameOrId("pending_upload")
	if err != nil {
		pendingUpload := core.NewBaseCollection("pending_upload")
		pendingUpload.Fields.Add(
			&core.RelationField{
				Name:         "user",
				Required:     true,
				CollectionId: usersCollection.Id,
				MaxSelect:    1,
			},
			&core.TextField{
				Name:     "key",
				Required: true,
			},
			&core.DateField{
				Name:     "expires_at",
				Required: true,
			},
		)
		pendingUpload.AddIndex("idx_pending_upload_key", true, "`key`", "")
		if err := app.Save(pendingUpload); err != nil {
			return err
		}
	}

	// 2. Check/create uploads
	_, err = app.FindCollectionByNameOrId("uploads")
	if err != nil {
		uploads := core.NewBaseCollection("uploads")
		uploads.Fields.Add(
			&core.RelationField{
				Name:         "user",
				Required:     true,
				CollectionId: usersCollection.Id,
				MaxSelect:    1,
			},
			&core.TextField{
				Name:     "key",
				Required: true,
			},
		)
		uploads.AddIndex("idx_uploads_key", true, "`key`", "")
		if err := app.Save(uploads); err != nil {
			return err
		}
	}

	return nil
}

type FinalizeRequest struct {
	Key string `json:"key"`
}

func main() {
	app := pocketbase.New()

	// S3 Configuration
	s3Endpoint := getEnv("S3_ENDPOINT", "http://127.0.0.1:9000")
	s3AccessKey := getEnv("S3_ACCESS_KEY", "minioadmin")
	s3SecretKey := getEnv("S3_SECRET_KEY", "minioadmin")
	s3Region := getEnv("S3_REGION", "us-east-1")
	s3Bucket := getEnv("S3_BUCKET", "uploads")

	// Initialize S3 Go SDK v2 Client
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(s3Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(s3AccessKey, s3SecretKey, "")),
	)
	if err != nil {
		log.Fatalf("Failed to load S3 SDK configuration: %v", err)
	}

	s3Client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(s3Endpoint)
		o.UsePathStyle = true
	})

	presignClient := s3.NewPresignClient(s3Client)

	// Lifecycle hooks
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		return ensureCollectionsExist(e.App)
	})

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		g := se.Router.Group("/api/uploads")
		g.Bind(apis.RequireAuth("users"))

		// POST /api/uploads/presign
		g.POST("/presign", func(e *core.RequestEvent) error {
			if e.Auth == nil {
				return e.UnauthorizedError("Unauthorized", nil)
			}

			key := uuid.New().String()
			now := time.Now()
			expiresAt := now.Add(300 * time.Second)

			// Create record in pending_upload
			collection, err := e.App.FindCollectionByNameOrId("pending_upload")
			if err != nil {
				return e.BadRequestError("Pending upload collection not found", err)
			}

			pendingRecord := core.NewRecord(collection)
			pendingRecord.Set("user", e.Auth.Id)
			pendingRecord.Set("key", key)
			pendingRecord.Set("expires_at", types.DateTime{Time: expiresAt})

			if err := e.App.Save(pendingRecord); err != nil {
				return e.BadRequestError("Failed to save pending upload record", err)
			}

			// Generate S3 PUT presigned URL
			presignedReq, err := presignClient.PresignPutObject(e.Request.Context(), &s3.PutObjectInput{
				Bucket: aws.String(s3Bucket),
				Key:    aws.String(key),
			}, s3.WithPresignExpires(300 * time.Second))
			if err != nil {
				// Clean up the DB record if presign fails
				_ = e.App.Delete(pendingRecord)
				return e.BadRequestError("Failed to generate presigned URL", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"url":       presignedReq.URL,
				"key":       key,
				"expiresAt": expiresAt.Format(time.RFC3339),
			})
		})

		// POST /api/uploads/finalize
		g.POST("/finalize", func(e *core.RequestEvent) error {
			if e.Auth == nil {
				return e.UnauthorizedError("Unauthorized", nil)
			}

			var reqData FinalizeRequest
			if err := e.BindBody(&reqData); err != nil {
				return e.BadRequestError("Invalid request body", err)
			}

			if reqData.Key == "" {
				return e.BadRequestError("Missing key in request body", nil)
			}

			// 1. Verify record exists in pending_upload and belongs to the authenticated user
			pendingRecord, err := e.App.FindFirstRecordByFilter(
				"pending_upload",
				"key = {:key}",
				dbx.Params{"key": reqData.Key},
			)
			if err != nil {
				return e.NotFoundError("Pending upload not found", err)
			}

			if pendingRecord.GetString("user") != e.Auth.Id {
				return e.NotFoundError("Pending upload belongs to a different user", nil)
			}

			// 2. Verify object exists in S3 via a HEAD request
			_, err = s3Client.HeadObject(e.Request.Context(), &s3.HeadObjectInput{
				Bucket: aws.String(s3Bucket),
				Key:    aws.String(reqData.Key),
			})
			if err != nil {
				if isS3NotFoundError(err) {
					return e.NotFoundError("Object not found in S3", err)
				}
				return e.BadRequestError("Failed to verify object existence in S3", err)
			}

			// 3. Delete the pending_upload row
			if err := e.App.Delete(pendingRecord); err != nil {
				return e.BadRequestError("Failed to delete pending upload record", err)
			}

			// 4. Create new uploads row
			uploadsCollection, err := e.App.FindCollectionByNameOrId("uploads")
			if err != nil {
				return e.BadRequestError("Uploads collection not found", err)
			}

			uploadRecord := core.NewRecord(uploadsCollection)
			uploadRecord.Set("user", e.Auth.Id)
			uploadRecord.Set("key", reqData.Key)

			if err := e.App.Save(uploadRecord); err != nil {
				return e.BadRequestError("Failed to save upload record", err)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"key": reqData.Key,
			})
		})

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
