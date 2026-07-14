import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { handleFileDownload } from "@/app/files";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  route("/files/:key", [
    ({ request, params }) =>
      handleFileDownload(request, { params: params as { key: string } }),
  ]),
  render(Document, [route("/", Home)]),
]);
