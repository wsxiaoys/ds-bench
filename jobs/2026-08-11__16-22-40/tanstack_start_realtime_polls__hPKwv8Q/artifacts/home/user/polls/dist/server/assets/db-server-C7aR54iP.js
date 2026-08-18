import { T as TSS_SERVER_FUNCTION, c as createServerFn } from "../server.js";
import "node:async_hooks";
import "h3-v2";
import "@tanstack/router-core";
import "seroval";
import "@tanstack/history";
import "@tanstack/router-core/ssr/client";
import "@tanstack/router-core/ssr/server";
import "react";
import "@tanstack/react-router";
import "react/jsx-runtime";
import "@tanstack/react-router/ssr/server";
var createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const getPollsFn_createServerFn_handler = createServerRpc({
  id: "71e164b088516cdf38321a9c5af96f0d575a80ef2e6dc523902f9d007befd466",
  name: "getPollsFn",
  filename: "src/utils/db-server.ts"
}, (opts) => getPollsFn.__executeServer(opts));
const getPollsFn = createServerFn({
  method: "GET"
}).handler(getPollsFn_createServerFn_handler, async () => {
  const {
    listPolls
  } = await import("./db-BgzlcB5H.js");
  return listPolls();
});
const getPollFn_createServerFn_handler = createServerRpc({
  id: "1e9c19c61edb103ded5c18abfd90f2f897fd1937feeefac267aca7b5a7146301",
  name: "getPollFn",
  filename: "src/utils/db-server.ts"
}, (opts) => getPollFn.__executeServer(opts));
const getPollFn = createServerFn({
  method: "GET"
}).validator((id) => id).handler(getPollFn_createServerFn_handler, async ({
  data: id
}) => {
  const {
    getPoll
  } = await import("./db-BgzlcB5H.js");
  return getPoll(id);
});
export {
  getPollFn_createServerFn_handler,
  getPollsFn_createServerFn_handler
};
