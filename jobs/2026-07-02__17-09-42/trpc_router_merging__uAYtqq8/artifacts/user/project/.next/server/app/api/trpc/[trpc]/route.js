/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/trpc/[trpc]/route";
exports.ids = ["app/api/trpc/[trpc]/route"];
exports.modules = {

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&page=%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute.ts&appDir=%2Fhome%2Fuser%2Fproject%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fuser%2Fproject&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!*******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&page=%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute.ts&appDir=%2Fhome%2Fuser%2Fproject%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fuser%2Fproject&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \*******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _home_user_project_src_app_api_trpc_trpc_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./src/app/api/trpc/[trpc]/route.ts */ \"(rsc)/./src/app/api/trpc/[trpc]/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/trpc/[trpc]/route\",\n        pathname: \"/api/trpc/[trpc]\",\n        filename: \"route\",\n        bundlePath: \"app/api/trpc/[trpc]/route\"\n    },\n    resolvedPagePath: \"/home/user/project/src/app/api/trpc/[trpc]/route.ts\",\n    nextConfigOutput,\n    userland: _home_user_project_src_app_api_trpc_trpc_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZ0cnBjJTJGJTVCdHJwYyU1RCUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGdHJwYyUyRiU1QnRycGMlNUQlMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkZ0cnBjJTJGJTVCdHJwYyU1RCUyRnJvdXRlLnRzJmFwcERpcj0lMkZob21lJTJGdXNlciUyRnByb2plY3QlMkZzcmMlMkZhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPSUyRmhvbWUlMkZ1c2VyJTJGcHJvamVjdCZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBK0Y7QUFDdkM7QUFDcUI7QUFDRztBQUNoRjtBQUNBO0FBQ0E7QUFDQSx3QkFBd0IseUdBQW1CO0FBQzNDO0FBQ0EsY0FBYyxrRUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLHNEQUFzRDtBQUM5RDtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUMwRjs7QUFFMUYiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly90cnBjLW1lcmdpbmctdGFzay8/NmFjZSJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1raW5kXCI7XG5pbXBvcnQgeyBwYXRjaEZldGNoIGFzIF9wYXRjaEZldGNoIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvbGliL3BhdGNoLWZldGNoXCI7XG5pbXBvcnQgKiBhcyB1c2VybGFuZCBmcm9tIFwiL2hvbWUvdXNlci9wcm9qZWN0L3NyYy9hcHAvYXBpL3RycGMvW3RycGNdL3JvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS90cnBjL1t0cnBjXS9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL3RycGMvW3RycGNdXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS90cnBjL1t0cnBjXS9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIi9ob21lL3VzZXIvcHJvamVjdC9zcmMvYXBwL2FwaS90cnBjL1t0cnBjXS9yb3V0ZS50c1wiLFxuICAgIG5leHRDb25maWdPdXRwdXQsXG4gICAgdXNlcmxhbmRcbn0pO1xuLy8gUHVsbCBvdXQgdGhlIGV4cG9ydHMgdGhhdCB3ZSBuZWVkIHRvIGV4cG9zZSBmcm9tIHRoZSBtb2R1bGUuIFRoaXMgc2hvdWxkXG4vLyBiZSBlbGltaW5hdGVkIHdoZW4gd2UndmUgbW92ZWQgdGhlIG90aGVyIHJvdXRlcyB0byB0aGUgbmV3IGZvcm1hdC4gVGhlc2Vcbi8vIGFyZSB1c2VkIHRvIGhvb2sgaW50byB0aGUgcm91dGUuXG5jb25zdCB7IHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5mdW5jdGlvbiBwYXRjaEZldGNoKCkge1xuICAgIHJldHVybiBfcGF0Y2hGZXRjaCh7XG4gICAgICAgIHdvcmtBc3luY1N0b3JhZ2UsXG4gICAgICAgIHdvcmtVbml0QXN5bmNTdG9yYWdlXG4gICAgfSk7XG59XG5leHBvcnQgeyByb3V0ZU1vZHVsZSwgd29ya0FzeW5jU3RvcmFnZSwgd29ya1VuaXRBc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&page=%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute.ts&appDir=%2Fhome%2Fuser%2Fproject%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fuser%2Fproject&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(rsc)/./src/app/api/trpc/[trpc]/route.ts":
/*!******************************************!*\
  !*** ./src/app/api/trpc/[trpc]/route.ts ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ handler),\n/* harmony export */   POST: () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var _trpc_server_adapters_fetch__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @trpc/server/adapters/fetch */ \"(rsc)/./node_modules/@trpc/server/dist/adapters/fetch/index.mjs\");\n/* harmony import */ var _server_routers_app__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/server/routers/_app */ \"(rsc)/./src/server/routers/_app.ts\");\n\n\nconst handler = (req)=>(0,_trpc_server_adapters_fetch__WEBPACK_IMPORTED_MODULE_0__.fetchRequestHandler)({\n        endpoint: '/api/trpc',\n        req,\n        router: _server_routers_app__WEBPACK_IMPORTED_MODULE_1__.appRouter,\n        createContext: ()=>({})\n    });\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvYXBwL2FwaS90cnBjL1t0cnBjXS9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQWtFO0FBQ2hCO0FBRWxELE1BQU1FLFVBQVUsQ0FBQ0MsTUFDZkgsZ0ZBQW1CQSxDQUFDO1FBQ2xCSSxVQUFVO1FBQ1ZEO1FBQ0FFLFFBQVFKLDBEQUFTQTtRQUNqQkssZUFBZSxJQUFPLEVBQUM7SUFDekI7QUFFeUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly90cnBjLW1lcmdpbmctdGFzay8uL3NyYy9hcHAvYXBpL3RycGMvW3RycGNdL3JvdXRlLnRzPzQzZDciXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmV0Y2hSZXF1ZXN0SGFuZGxlciB9IGZyb20gJ0B0cnBjL3NlcnZlci9hZGFwdGVycy9mZXRjaCc7XG5pbXBvcnQgeyBhcHBSb3V0ZXIgfSBmcm9tICdAL3NlcnZlci9yb3V0ZXJzL19hcHAnO1xuXG5jb25zdCBoYW5kbGVyID0gKHJlcTogUmVxdWVzdCkgPT5cbiAgZmV0Y2hSZXF1ZXN0SGFuZGxlcih7XG4gICAgZW5kcG9pbnQ6ICcvYXBpL3RycGMnLFxuICAgIHJlcSxcbiAgICByb3V0ZXI6IGFwcFJvdXRlcixcbiAgICBjcmVhdGVDb250ZXh0OiAoKSA9PiAoe30pLFxuICB9KTtcblxuZXhwb3J0IHsgaGFuZGxlciBhcyBHRVQsIGhhbmRsZXIgYXMgUE9TVCB9OyJdLCJuYW1lcyI6WyJmZXRjaFJlcXVlc3RIYW5kbGVyIiwiYXBwUm91dGVyIiwiaGFuZGxlciIsInJlcSIsImVuZHBvaW50Iiwicm91dGVyIiwiY3JlYXRlQ29udGV4dCIsIkdFVCIsIlBPU1QiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/app/api/trpc/[trpc]/route.ts\n");

/***/ }),

/***/ "(rsc)/./src/server/routers/_app.ts":
/*!************************************!*\
  !*** ./src/server/routers/_app.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   appRouter: () => (/* binding */ appRouter)\n/* harmony export */ });\n/* harmony import */ var _trpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../trpc */ \"(rsc)/./src/server/trpc.ts\");\n/* harmony import */ var _user__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./user */ \"(rsc)/./src/server/routers/user.ts\");\n/* harmony import */ var _post__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./post */ \"(rsc)/./src/server/routers/post.ts\");\n\n\n\nconst appRouter = (0,_trpc__WEBPACK_IMPORTED_MODULE_0__.router)({\n    user: _user__WEBPACK_IMPORTED_MODULE_1__.userRouter,\n    post: _post__WEBPACK_IMPORTED_MODULE_2__.postRouter\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvc2VydmVyL3JvdXRlcnMvX2FwcC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQWlDO0FBQ0c7QUFDQTtBQUU3QixNQUFNRyxZQUFZSCw2Q0FBTUEsQ0FBQztJQUM5QkksTUFBTUgsNkNBQVVBO0lBQ2hCSSxNQUFNSCw2Q0FBVUE7QUFDbEIsR0FBRyIsInNvdXJjZXMiOlsid2VicGFjazovL3RycGMtbWVyZ2luZy10YXNrLy4vc3JjL3NlcnZlci9yb3V0ZXJzL19hcHAudHM/MTc3NiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByb3V0ZXIgfSBmcm9tICcuLi90cnBjJztcbmltcG9ydCB7IHVzZXJSb3V0ZXIgfSBmcm9tICcuL3VzZXInO1xuaW1wb3J0IHsgcG9zdFJvdXRlciB9IGZyb20gJy4vcG9zdCc7XG5cbmV4cG9ydCBjb25zdCBhcHBSb3V0ZXIgPSByb3V0ZXIoe1xuICB1c2VyOiB1c2VyUm91dGVyLFxuICBwb3N0OiBwb3N0Um91dGVyLFxufSk7XG5cbmV4cG9ydCB0eXBlIEFwcFJvdXRlciA9IHR5cGVvZiBhcHBSb3V0ZXI7Il0sIm5hbWVzIjpbInJvdXRlciIsInVzZXJSb3V0ZXIiLCJwb3N0Um91dGVyIiwiYXBwUm91dGVyIiwidXNlciIsInBvc3QiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/server/routers/_app.ts\n");

/***/ }),

/***/ "(rsc)/./src/server/routers/post.ts":
/*!************************************!*\
  !*** ./src/server/routers/post.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   postRouter: () => (/* binding */ postRouter)\n/* harmony export */ });\n/* harmony import */ var _trpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../trpc */ \"(rsc)/./src/server/trpc.ts\");\n\nconst postRouter = (0,_trpc__WEBPACK_IMPORTED_MODULE_0__.router)({\n    getPost: _trpc__WEBPACK_IMPORTED_MODULE_0__.publicProcedure.query(({ input })=>{\n        return {\n            id: \"1\",\n            title: \"Hello World\"\n        };\n    })\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvc2VydmVyL3JvdXRlcnMvcG9zdC50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUFrRDtBQUMzQyxNQUFNRSxhQUFhRCw2Q0FBTUEsQ0FBQztJQUMvQkUsU0FBU0gsa0RBQWVBLENBQUNJLEtBQUssQ0FBQyxDQUFDLEVBQUVDLEtBQUssRUFBRTtRQUN2QyxPQUFPO1lBQUVDLElBQUk7WUFBS0MsT0FBTztRQUFjO0lBQ3pDO0FBQ0YsR0FBRyIsInNvdXJjZXMiOlsid2VicGFjazovL3RycGMtbWVyZ2luZy10YXNrLy4vc3JjL3NlcnZlci9yb3V0ZXJzL3Bvc3QudHM/M2QyZCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwdWJsaWNQcm9jZWR1cmUsIHJvdXRlciB9IGZyb20gJy4uL3RycGMnO1xuZXhwb3J0IGNvbnN0IHBvc3RSb3V0ZXIgPSByb3V0ZXIoe1xuICBnZXRQb3N0OiBwdWJsaWNQcm9jZWR1cmUucXVlcnkoKHsgaW5wdXQgfSkgPT4ge1xuICAgIHJldHVybiB7IGlkOiBcIjFcIiwgdGl0bGU6IFwiSGVsbG8gV29ybGRcIiB9O1xuICB9KSxcbn0pO1xuIl0sIm5hbWVzIjpbInB1YmxpY1Byb2NlZHVyZSIsInJvdXRlciIsInBvc3RSb3V0ZXIiLCJnZXRQb3N0IiwicXVlcnkiLCJpbnB1dCIsImlkIiwidGl0bGUiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/server/routers/post.ts\n");

/***/ }),

/***/ "(rsc)/./src/server/routers/user.ts":
/*!************************************!*\
  !*** ./src/server/routers/user.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   userRouter: () => (/* binding */ userRouter)\n/* harmony export */ });\n/* harmony import */ var _trpc__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../trpc */ \"(rsc)/./src/server/trpc.ts\");\n\nconst userRouter = (0,_trpc__WEBPACK_IMPORTED_MODULE_0__.router)({\n    getUser: _trpc__WEBPACK_IMPORTED_MODULE_0__.publicProcedure.query(({ input })=>{\n        return {\n            id: \"1\",\n            name: \"Alice\"\n        };\n    })\n});\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvc2VydmVyL3JvdXRlcnMvdXNlci50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUFrRDtBQUMzQyxNQUFNRSxhQUFhRCw2Q0FBTUEsQ0FBQztJQUMvQkUsU0FBU0gsa0RBQWVBLENBQUNJLEtBQUssQ0FBQyxDQUFDLEVBQUVDLEtBQUssRUFBRTtRQUN2QyxPQUFPO1lBQUVDLElBQUk7WUFBS0MsTUFBTTtRQUFRO0lBQ2xDO0FBQ0YsR0FBRyIsInNvdXJjZXMiOlsid2VicGFjazovL3RycGMtbWVyZ2luZy10YXNrLy4vc3JjL3NlcnZlci9yb3V0ZXJzL3VzZXIudHM/YzQ0MiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwdWJsaWNQcm9jZWR1cmUsIHJvdXRlciB9IGZyb20gJy4uL3RycGMnO1xuZXhwb3J0IGNvbnN0IHVzZXJSb3V0ZXIgPSByb3V0ZXIoe1xuICBnZXRVc2VyOiBwdWJsaWNQcm9jZWR1cmUucXVlcnkoKHsgaW5wdXQgfSkgPT4ge1xuICAgIHJldHVybiB7IGlkOiBcIjFcIiwgbmFtZTogXCJBbGljZVwiIH07XG4gIH0pLFxufSk7XG4iXSwibmFtZXMiOlsicHVibGljUHJvY2VkdXJlIiwicm91dGVyIiwidXNlclJvdXRlciIsImdldFVzZXIiLCJxdWVyeSIsImlucHV0IiwiaWQiLCJuYW1lIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./src/server/routers/user.ts\n");

/***/ }),

/***/ "(rsc)/./src/server/trpc.ts":
/*!****************************!*\
  !*** ./src/server/trpc.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   publicProcedure: () => (/* binding */ publicProcedure),\n/* harmony export */   router: () => (/* binding */ router)\n/* harmony export */ });\n/* harmony import */ var _trpc_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @trpc/server */ \"(rsc)/./node_modules/@trpc/server/dist/index.mjs\");\n\nconst t = _trpc_server__WEBPACK_IMPORTED_MODULE_0__.initTRPC.create();\nconst router = t.router;\nconst publicProcedure = t.procedure;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvc2VydmVyL3RycGMudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQXdDO0FBQ3hDLE1BQU1DLElBQUlELGtEQUFRQSxDQUFDRSxNQUFNO0FBQ2xCLE1BQU1DLFNBQVNGLEVBQUVFLE1BQU0sQ0FBQztBQUN4QixNQUFNQyxrQkFBa0JILEVBQUVJLFNBQVMsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3RycGMtbWVyZ2luZy10YXNrLy4vc3JjL3NlcnZlci90cnBjLnRzPzQ1N2EiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaW5pdFRSUEMgfSBmcm9tICdAdHJwYy9zZXJ2ZXInO1xuY29uc3QgdCA9IGluaXRUUlBDLmNyZWF0ZSgpO1xuZXhwb3J0IGNvbnN0IHJvdXRlciA9IHQucm91dGVyO1xuZXhwb3J0IGNvbnN0IHB1YmxpY1Byb2NlZHVyZSA9IHQucHJvY2VkdXJlO1xuIl0sIm5hbWVzIjpbImluaXRUUlBDIiwidCIsImNyZWF0ZSIsInJvdXRlciIsInB1YmxpY1Byb2NlZHVyZSIsInByb2NlZHVyZSJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./src/server/trpc.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@trpc"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&page=%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Ftrpc%2F%5Btrpc%5D%2Froute.ts&appDir=%2Fhome%2Fuser%2Fproject%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2Fuser%2Fproject&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();