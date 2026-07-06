package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

const runIDPath = "/logs/artifacts/run-id"

// readRunID reads the run identifier from the artifacts log file.
func readRunID(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("failed to read run-id file: %w", err)
	}
	return strings.TrimSpace(string(data)), nil
}

// newS3PresignClient builds an S3 client configured from environment variables.
func newS3PresignClient(ctx context.Context) (*s3.PresignClient, string, error) {
	region := os.Getenv("AWS_REGION")
	accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
	secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
	bucket := os.Getenv("AWS_BUCKET")

	if region == "" || accessKey == "" || secretKey == "" || bucket == "" {
		return nil, "", fmt.Errorf("missing required S3 env vars (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET)")
	}

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, "", fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := s3.NewFromConfig(cfg)
	presignClient := s3.NewPresignClient(client, func(o *s3.PresignOptions) {
		o.Expires = 15 * time.Minute
	})

	return presignClient, bucket, nil
}

func main() {
	app := pocketbase.New()

	app.OnBeforeServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/api/s3-presign", func(c *core.RequestEvent) error {
			filename := c.Request.URL.Query().Get("filename")
			if filename == "" {
				return c.BadRequestError("missing required query parameter: filename", nil)
			}

			runID, err := readRunID(runIDPath)
			if err != nil {
				return c.InternalServerError("failed to read run-id", err)
			}

			objectKey := fmt.Sprintf("uploads/%s/%s", runID, filename)

			presignClient, bucket, err := newS3PresignClient(c.Request.Context())
			if err != nil {
				return c.InternalServerError("failed to configure S3 client", err)
			}

			presignResult, err := presignClient.PresignPutObject(c.Request.Context(), &s3.PutObjectInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(objectKey),
			})
			if err != nil {
				return c.InternalServerError("failed to generate presigned URL", err)
			}

			return c.JSON(http.StatusOK, map[string]string{
				"url": presignResult.URL,
			})
		})

		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}