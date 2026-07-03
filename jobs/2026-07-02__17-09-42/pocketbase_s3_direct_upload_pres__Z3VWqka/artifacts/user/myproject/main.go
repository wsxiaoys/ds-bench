package main

import (
	"context"
	"log"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

const runIDFilePath = "/logs/artifacts/run-id"

// s3PresignRequest is the JSON payload returned by GET /api/s3-presign.
type s3PresignRequest struct {
	URL string `json:"url"`
}

// s3PresignError is a simple JSON error response.
type s3PresignError struct {
	Error string `json:"error"`
}

// readRunID loads the run identifier from /logs/artifacts/run-id and trims
// surrounding whitespace (including trailing newlines).
func readRunID() (string, error) {
	data, err := os.ReadFile(runIDFilePath)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

// newS3Presigner constructs a presigner backed by credentials loaded from
// environment variables so the route works without a shared AWS config file.
func newS3Presigner(ctx context.Context, region, accessKey, secretKey string) (*s3.PresignClient, error) {
	cfg, err := awsconfig.LoadDefaultConfig(
		ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
		),
	)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.Region = region
	})
	return s3.NewPresignClient(client), nil
}

func registerS3PresignRoute(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/s3-presign", func(e *core.RequestEvent) error {
			filename := e.Request.URL.Query().Get("filename")
			if strings.TrimSpace(filename) == "" {
				return e.JSON(400, s3PresignError{Error: "filename query parameter is required"})
			}

			runID, err := readRunID()
			if err != nil {
				return e.JSON(500, s3PresignError{Error: "failed to read run id: " + err.Error()})
			}
			if runID == "" {
				return e.JSON(500, s3PresignError{Error: "run id file is empty"})
			}

			region := os.Getenv("AWS_REGION")
			accessKey := os.Getenv("AWS_ACCESS_KEY_ID")
			secretKey := os.Getenv("AWS_SECRET_ACCESS_KEY")
			bucket := os.Getenv("AWS_BUCKET")
			if region == "" || accessKey == "" || secretKey == "" || bucket == "" {
				return e.JSON(500, s3PresignError{Error: "missing AWS configuration (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET)"})
			}

			presigner, err := newS3Presigner(e.Request.Context(), region, accessKey, secretKey)
			if err != nil {
				return e.JSON(500, s3PresignError{Error: "failed to create S3 client: " + err.Error()})
			}

			objectKey := "uploads/" + runID + "/" + filename
			presignReq, err := presigner.PresignPutObject(e.Request.Context(), &s3.PutObjectInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(objectKey),
			}, s3.WithPresignExpires(15*time.Minute))
			if err != nil {
				return e.JSON(500, s3PresignError{Error: "failed to presign URL: " + err.Error()})
			}

			return e.JSON(200, s3PresignRequest{URL: presignReq.URL})
		})
		return se.Next()
	})
}

func main() {
	app := pocketbase.New()

	registerS3PresignRoute(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
