// app.config.ts
import { defineConfig } from "@tanstack/start/config";
var app_config_default = defineConfig({
  server: {
    port: 4813,
    host: "127.0.0.1"
  }
});
export {
  app_config_default as default
};
