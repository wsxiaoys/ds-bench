// app.config.ts
import { defineConfig } from "@tanstack/start/config";
var app_config_default = defineConfig({
  server: {
    port: 8234
  }
});
export {
  app_config_default as default
};
