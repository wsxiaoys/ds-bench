# RedwoodSDK R2 File Download with HTTP Range Support

## Background
You are working in an existing RedwoodSDK (rwsdk) project. RedwoodSDK is a server-first React framework for Cloudflare that uses the standard Web `Request`/`Response` objects and integrates natively with Cloudflare R2 object storage. Your job is to build a file download endpoint that streams an object out of an R2 bucket and correctly implements HTTP Range requests so that large files and media can be fetched in byte ranges.

## Requirements
- Bind a Cloudflare R2 bucket to the worker and make it available to your route handler.
- Seed the bucket with a sample object so it can be downloaded (see the contract below for the exact fixture).
- Implement a GET download endpoint that streams the object body from R2.
- Honor the incoming `Range` request header: return `206 Partial Content` with only the requested bytes when a range is present, and `200 OK` with the full object otherwise.
- Return `404` when the requested object key does not exist.

## Implementation Hints
- Configure the R2 binding in `wrangler.jsonc` (an `r2_buckets` entry with a `binding` and `bucket_name`). After changing bindings, regenerate the Cloudflare types.
- Access the binding through the worker `env` (e.g. `import { env } from "cloudflare:workers"`), and use the R2 `get`/`head`/`put` methods. `get` returns `null` when the key is missing.
- The R2 `get` method accepts a `range` option (`{ offset, length }` or `{ suffix }`) so you can fetch only part of an object without loading it all into memory. The returned object exposes its total `size` and the resolved `range`, which you need to build the `Content-Range` header.
- Parse the standard `Range` header syntax: `bytes=start-end`, `bytes=start-` (open-ended), and `bytes=-suffix` (last N bytes).
- Stream the body by passing the R2 object's `body` (a `ReadableStream`) directly to the `Response` constructor; do not buffer the whole file.
- Because workers cannot perform I/O at module top level, seed the sample object lazily inside the request lifecycle (e.g. check with `head` and `put` it if missing) rather than at import time.

## API Contract
- Project path: /home/user/project
- Start command: npm run dev
- Port: 5173
- R2 fixture: the bound bucket must contain an object with key `alphabet.txt` whose body is exactly the 26 lowercase ASCII letters `abcdefghijklmnopqrstuvwxyz` (26 bytes) served with `Content-Type: text/plain`. The endpoint must make this object available for download after the server starts.
- Endpoint: `GET /files/:key` downloads the R2 object identified by the `key` path parameter.
  - When no `Range` header is sent and the key exists: respond with status `200`, the full object body, an `Accept-Ranges: bytes` header, and a `Content-Length` header equal to the object size in bytes.
  - When a valid `Range` header is sent and the key exists: respond with status `206`, only the requested bytes as the body, an `Accept-Ranges: bytes` header, a `Content-Range: bytes <start>-<end>/<total>` header (0-based, inclusive `start`/`end`; `total` is the full object size), and a `Content-Length` header equal to the number of bytes returned in the partial body. Support the `bytes=start-end`, `bytes=start-`, and `bytes=-suffix` forms.
  - When the key does not exist: respond with status `404`.

