package main

import (
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

func main() {
	app := pocketbase.New()

	// Read run-id from /logs/artifacts/run-id
	runIDBytes, err := os.ReadFile("/logs/artifacts/run-id")
	if err != nil {
		log.Printf("Warning: failed to read run-id from /logs/artifacts/run-id: %v", err)
	}
	runID := strings.TrimSpace(string(runIDBytes))

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/api/s3-presign", func(re *core.RequestEvent) error {
			filename := re.Request.URL.Query().Get("filename")
			if filename == "" {
				return re.BadRequestError("filename query parameter is required", nil)
			}

			// Read S3 configuration from environment variables
			awsRegion := os.Getenv("AWS_REGION")
			awsAccessKeyID := os.Getenv("AWS_ACCESS_KEY_ID")
			awsSecretAccessKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
			awsBucket := os.Getenv("AWS_BUCKET")

			if awsRegion == "" || awsAccessKeyID == "" || awsSecretAccessKey == "" || awsBucket == "" {
				return re.InternalServerError("S3 environment configuration is incomplete", nil)
			}

			// Initialize AWS config and S3 client
			cfg, err := config.LoadDefaultConfig(re.Request.Context(),
				config.WithRegion(awsRegion),
				config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(awsAccessKeyID, awsSecretAccessKey, "")),
			)
			if err != nil {
				return re.InternalServerError("Failed to load AWS config: "+err.Error(), nil)
			}

			s3Client := s3.NewFromConfig(cfg)
			presignClient := s3.NewPresignClient(s3Client)

			// Resolve the run-id
			effectiveRunID := runID
			if effectiveRunID == "" {
				// Fallback to reading it on-demand in case the file wasn't ready during startup
				if b, err := os.ReadFile("/logs/artifacts/run-id"); err == nil {
					effectiveRunID = strings.TrimSpace(string(b))
				}
			}
			if effectiveRunID == "" {
				return re.InternalServerError("Run ID is not available", nil)
			}

			objectKey := "uploads/" + effectiveRunID + "/" + filename

			// Generate presigned PUT URL
			presignedReq, err := presignClient.PresignPutObject(re.Request.Context(), &s3.PutObjectInput{
				Bucket: aws.String(awsBucket),
				Key:    aws.String(objectKey),
			}, s3.WithPresignExpires(15*time.Minute))
			if err != nil {
				return re.InternalServerError("Failed to generate presigned URL: "+err.Error(), nil)
			}

			return re.JSON(http.StatusOK, map[string]string{
				"url": presignedReq.URL,
			})
		})

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
