import { T as TSS_SERVER_FUNCTION, c as createServerFn, a as getCookie } from "../server.js";
import { l as listAllPolls, g as getPoll, h as hasClientVoted, c as createPoll } from "./db-BA0ZmELm.js";
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
import "sqlite3";
import "sqlite";
import "crypto";
var createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const getPollsFn_createServerFn_handler = createServerRpc({
  id: "c5075b2022b45ba158086587f128c119a4f570c4ff821c72e174f3a1e10ab271",
  name: "getPollsFn",
  filename: "src/server-fns.ts"
}, (opts) => getPollsFn.__executeServer(opts));
const getPollsFn = createServerFn({
  method: "GET"
}).handler(getPollsFn_createServerFn_handler, async () => {
  return await listAllPolls();
});
const getPollFn_createServerFn_handler = createServerRpc({
  id: "e3817fad326f8e36c80d06f7edeeba1b1e14c9f87a97d72688cf2c5042fdb7bf",
  name: "getPollFn",
  filename: "src/server-fns.ts"
}, (opts) => getPollFn.__executeServer(opts));
const getPollFn = createServerFn({
  method: "GET"
}).validator((id) => id).handler(getPollFn_createServerFn_handler, async ({
  data: id
}) => {
  const poll = await getPoll(id);
  if (!poll) return null;
  const clientId = getCookie("client_id");
  let hasVoted = false;
  if (clientId) {
    hasVoted = await hasClientVoted(id, clientId);
  }
  return {
    poll,
    hasVoted
  };
});
const createPollFn_createServerFn_handler = createServerRpc({
  id: "8b0b74f3fc455eef7eacad32a7323bfc88352970795b6ff79061ffea637c62d9",
  name: "createPollFn",
  filename: "src/server-fns.ts"
}, (opts) => createPollFn.__executeServer(opts));
const createPollFn = createServerFn({
  method: "POST"
}).validator((data) => data).handler(createPollFn_createServerFn_handler, async ({
  data
}) => {
  return await createPoll(data.question, data.options);
});
export {
  createPollFn_createServerFn_handler,
  getPollFn_createServerFn_handler,
  getPollsFn_createServerFn_handler
};
