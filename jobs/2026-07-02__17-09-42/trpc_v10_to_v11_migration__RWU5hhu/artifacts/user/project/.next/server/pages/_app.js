"use strict";
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
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./src/pages/_app.tsx":
/*!****************************!*\
  !*** ./src/pages/_app.tsx ***!
  \****************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _utils_trpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/trpc */ \"./src/utils/trpc.ts\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_utils_trpc__WEBPACK_IMPORTED_MODULE_1__]);\n_utils_trpc__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\n\nconst MyApp = ({ Component, pageProps })=>{\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n        ...pageProps\n    }, void 0, false, {\n        fileName: \"/home/user/project/src/pages/_app.tsx\",\n        lineNumber: 5,\n        columnNumber: 10\n    }, undefined);\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_utils_trpc__WEBPACK_IMPORTED_MODULE_1__.trpc.withTRPC(MyApp));\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvcGFnZXMvX2FwcC50c3giLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFDcUM7QUFFckMsTUFBTUMsUUFBaUIsQ0FBQyxFQUFFQyxTQUFTLEVBQUVDLFNBQVMsRUFBRTtJQUM5QyxxQkFBTyw4REFBQ0Q7UUFBVyxHQUFHQyxTQUFTOzs7Ozs7QUFDakM7QUFFQSxpRUFBZUgsNkNBQUlBLENBQUNJLFFBQVEsQ0FBQ0gsTUFBTUEsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3RycGMtdjEwLWFwcC8uL3NyYy9wYWdlcy9fYXBwLnRzeD9mOWQ2Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQXBwVHlwZSB9IGZyb20gJ25leHQvYXBwJztcbmltcG9ydCB7IHRycGMgfSBmcm9tICcuLi91dGlscy90cnBjJztcblxuY29uc3QgTXlBcHA6IEFwcFR5cGUgPSAoeyBDb21wb25lbnQsIHBhZ2VQcm9wcyB9KSA9PiB7XG4gIHJldHVybiA8Q29tcG9uZW50IHsuLi5wYWdlUHJvcHN9IC8+O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgdHJwYy53aXRoVFJQQyhNeUFwcCk7XG4iXSwibmFtZXMiOlsidHJwYyIsIk15QXBwIiwiQ29tcG9uZW50IiwicGFnZVByb3BzIiwid2l0aFRSUEMiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/pages/_app.tsx\n");

/***/ }),

/***/ "./src/utils/trpc.ts":
/*!***************************!*\
  !*** ./src/utils/trpc.ts ***!
  \***************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   trpc: () => (/* binding */ trpc)\n/* harmony export */ });\n/* harmony import */ var _trpc_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @trpc/client */ \"@trpc/client\");\n/* harmony import */ var _trpc_next__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @trpc/next */ \"@trpc/next\");\n/* harmony import */ var superjson__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! superjson */ \"superjson\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_trpc_client__WEBPACK_IMPORTED_MODULE_0__, _trpc_next__WEBPACK_IMPORTED_MODULE_1__, superjson__WEBPACK_IMPORTED_MODULE_2__]);\n([_trpc_client__WEBPACK_IMPORTED_MODULE_0__, _trpc_next__WEBPACK_IMPORTED_MODULE_1__, superjson__WEBPACK_IMPORTED_MODULE_2__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);\n\n\n\nfunction getBaseUrl() {\n    if (false) {}\n    return `http://localhost:${process.env.PORT ?? 3000}`;\n}\nconst trpc = (0,_trpc_next__WEBPACK_IMPORTED_MODULE_1__.createTRPCNext)({\n    config () {\n        return {\n            links: [\n                (0,_trpc_client__WEBPACK_IMPORTED_MODULE_0__.httpBatchLink)({\n                    url: `${getBaseUrl()}/api/trpc`,\n                    transformer: superjson__WEBPACK_IMPORTED_MODULE_2__[\"default\"]\n                })\n            ]\n        };\n    },\n    ssr: false\n});\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvdXRpbHMvdHJwYy50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQTZDO0FBQ0Q7QUFFVjtBQUVsQyxTQUFTRztJQUNQLElBQUksS0FBa0IsRUFBYSxFQUFPO0lBQzFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRUMsUUFBUUMsR0FBRyxDQUFDQyxJQUFJLElBQUksS0FBSyxDQUFDO0FBQ3ZEO0FBRU8sTUFBTUMsT0FBT04sMERBQWNBLENBQVk7SUFDNUNPO1FBQ0UsT0FBTztZQUNMQyxPQUFPO2dCQUNMVCwyREFBYUEsQ0FBQztvQkFDWlUsS0FBSyxDQUFDLEVBQUVQLGFBQWEsU0FBUyxDQUFDO29CQUMvQlEsYUFBYVQsaURBQVNBO2dCQUN4QjthQUNEO1FBQ0g7SUFDRjtJQUNBVSxLQUFLO0FBQ1AsR0FBRyIsInNvdXJjZXMiOlsid2VicGFjazovL3RycGMtdjEwLWFwcC8uL3NyYy91dGlscy90cnBjLnRzPzExYzgiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaHR0cEJhdGNoTGluayB9IGZyb20gJ0B0cnBjL2NsaWVudCc7XG5pbXBvcnQgeyBjcmVhdGVUUlBDTmV4dCB9IGZyb20gJ0B0cnBjL25leHQnO1xuaW1wb3J0IHR5cGUgeyBBcHBSb3V0ZXIgfSBmcm9tICcuLi9zZXJ2ZXIvcm91dGVycy9fYXBwJztcbmltcG9ydCBzdXBlcmpzb24gZnJvbSAnc3VwZXJqc29uJztcblxuZnVuY3Rpb24gZ2V0QmFzZVVybCgpIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSByZXR1cm4gJyc7XG4gIHJldHVybiBgaHR0cDovL2xvY2FsaG9zdDoke3Byb2Nlc3MuZW52LlBPUlQgPz8gMzAwMH1gO1xufVxuXG5leHBvcnQgY29uc3QgdHJwYyA9IGNyZWF0ZVRSUENOZXh0PEFwcFJvdXRlcj4oe1xuICBjb25maWcoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGxpbmtzOiBbXG4gICAgICAgIGh0dHBCYXRjaExpbmsoe1xuICAgICAgICAgIHVybDogYCR7Z2V0QmFzZVVybCgpfS9hcGkvdHJwY2AsXG4gICAgICAgICAgdHJhbnNmb3JtZXI6IHN1cGVyanNvbixcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH07XG4gIH0sXG4gIHNzcjogZmFsc2UsXG59KTsiXSwibmFtZXMiOlsiaHR0cEJhdGNoTGluayIsImNyZWF0ZVRSUENOZXh0Iiwic3VwZXJqc29uIiwiZ2V0QmFzZVVybCIsInByb2Nlc3MiLCJlbnYiLCJQT1JUIiwidHJwYyIsImNvbmZpZyIsImxpbmtzIiwidXJsIiwidHJhbnNmb3JtZXIiLCJzc3IiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/utils/trpc.ts\n");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "@trpc/client":
/*!*******************************!*\
  !*** external "@trpc/client" ***!
  \*******************************/
/***/ ((module) => {

module.exports = import("@trpc/client");;

/***/ }),

/***/ "@trpc/next":
/*!*****************************!*\
  !*** external "@trpc/next" ***!
  \*****************************/
/***/ ((module) => {

module.exports = import("@trpc/next");;

/***/ }),

/***/ "superjson":
/*!****************************!*\
  !*** external "superjson" ***!
  \****************************/
/***/ ((module) => {

module.exports = import("superjson");;

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("./src/pages/_app.tsx"));
module.exports = __webpack_exports__;

})();