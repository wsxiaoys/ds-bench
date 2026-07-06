package main

import (
	"log"

	"github.com/pocketbase/pocketbase"

	// register the user defined Go app migrations
	_ "myproject/migrations"
)

func main() {
	app := pocketbase.New()

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}