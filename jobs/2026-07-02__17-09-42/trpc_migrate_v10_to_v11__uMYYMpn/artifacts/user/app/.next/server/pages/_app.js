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

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _utils_trpc__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/trpc */ \"./src/utils/trpc.ts\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_utils_trpc__WEBPACK_IMPORTED_MODULE_1__]);\n_utils_trpc__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];\n\n\nfunction MyApp({ Component, pageProps }) {\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n        ...pageProps\n    }, void 0, false, {\n        fileName: \"/home/user/app/src/pages/_app.tsx\",\n        lineNumber: 5,\n        columnNumber: 10\n    }, this);\n}\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_utils_trpc__WEBPACK_IMPORTED_MODULE_1__.trpc.withTRPC(MyApp));\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvcGFnZXMvX2FwcC50c3giLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFDcUM7QUFFckMsU0FBU0MsTUFBTSxFQUFFQyxTQUFTLEVBQUVDLFNBQVMsRUFBWTtJQUMvQyxxQkFBTyw4REFBQ0Q7UUFBVyxHQUFHQyxTQUFTOzs7Ozs7QUFDakM7QUFFQSxpRUFBZUgsNkNBQUlBLENBQUNJLFFBQVEsQ0FBQ0gsTUFBTUEsRUFBQyIsInNvdXJjZXMiOlsid2VicGFjazovL3RycGMtdjEwLWFwcC8uL3NyYy9wYWdlcy9fYXBwLnRzeD9mOWQ2Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgQXBwUHJvcHMgfSBmcm9tICduZXh0L2FwcCc7XG5pbXBvcnQgeyB0cnBjIH0gZnJvbSAnLi4vdXRpbHMvdHJwYyc7XG5cbmZ1bmN0aW9uIE15QXBwKHsgQ29tcG9uZW50LCBwYWdlUHJvcHMgfTogQXBwUHJvcHMpIHtcbiAgcmV0dXJuIDxDb21wb25lbnQgey4uLnBhZ2VQcm9wc30gLz47XG59XG5cbmV4cG9ydCBkZWZhdWx0IHRycGMud2l0aFRSUEMoTXlBcHApO1xuIl0sIm5hbWVzIjpbInRycGMiLCJNeUFwcCIsIkNvbXBvbmVudCIsInBhZ2VQcm9wcyIsIndpdGhUUlBDIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./src/pages/_app.tsx\n");

/***/ }),

/***/ "./src/utils/trpc.ts":
/*!***************************!*\
  !*** ./src/utils/trpc.ts ***!
  \***************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {\n__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   trpc: () => (/* binding */ trpc)\n/* harmony export */ });\n/* harmony import */ var _trpc_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @trpc/client */ \"@trpc/client\");\n/* harmony import */ var _trpc_next__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @trpc/next */ \"@trpc/next\");\n/* harmony import */ var superjson__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! superjson */ \"superjson\");\nvar __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_trpc_client__WEBPACK_IMPORTED_MODULE_0__, _trpc_next__WEBPACK_IMPORTED_MODULE_1__, superjson__WEBPACK_IMPORTED_MODULE_2__]);\n([_trpc_client__WEBPACK_IMPORTED_MODULE_0__, _trpc_next__WEBPACK_IMPORTED_MODULE_1__, superjson__WEBPACK_IMPORTED_MODULE_2__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);\n\n\n\nfunction getBaseUrl() {\n    if (false) {}\n    return `http://localhost:${process.env.PORT ?? 3000}`;\n}\nconst trpc = (0,_trpc_next__WEBPACK_IMPORTED_MODULE_1__.createTRPCNext)({\n    config (opts) {\n        return {\n            links: [\n                (0,_trpc_client__WEBPACK_IMPORTED_MODULE_0__.httpBatchLink)({\n                    url: `${getBaseUrl()}/api/trpc`,\n                    transformer: superjson__WEBPACK_IMPORTED_MODULE_2__[\"default\"]\n                })\n            ]\n        };\n    },\n    ssr: false,\n    transformer: superjson__WEBPACK_IMPORTED_MODULE_2__[\"default\"]\n});\n\n__webpack_async_result__();\n} catch(e) { __webpack_async_result__(e); } });//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvdXRpbHMvdHJwYy50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQTZDO0FBQ0Q7QUFFVjtBQUVsQyxTQUFTRztJQUNQLElBQUksS0FBa0IsRUFDcEIsRUFBTztJQUNULE9BQU8sQ0FBQyxpQkFBaUIsRUFBRUMsUUFBUUMsR0FBRyxDQUFDQyxJQUFJLElBQUksS0FBSyxDQUFDO0FBQ3ZEO0FBRU8sTUFBTUMsT0FBT04sMERBQWNBLENBQVk7SUFDNUNPLFFBQU9DLElBQUk7UUFDVCxPQUFPO1lBQ0xDLE9BQU87Z0JBQ0xWLDJEQUFhQSxDQUFDO29CQUNaVyxLQUFLLENBQUMsRUFBRVIsYUFBYSxTQUFTLENBQUM7b0JBQy9CUyxhQUFhVixpREFBU0E7Z0JBQ3hCO2FBQ0Q7UUFDSDtJQUNGO0lBQ0FXLEtBQUs7SUFDTEQsYUFBYVYsaURBQVNBO0FBQ3hCLEdBQUciLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly90cnBjLXYxMC1hcHAvLi9zcmMvdXRpbHMvdHJwYy50cz8xMWM4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGh0dHBCYXRjaExpbmsgfSBmcm9tICdAdHJwYy9jbGllbnQnO1xuaW1wb3J0IHsgY3JlYXRlVFJQQ05leHQgfSBmcm9tICdAdHJwYy9uZXh0JztcbmltcG9ydCB0eXBlIHsgQXBwUm91dGVyIH0gZnJvbSAnLi4vc2VydmVyL3JvdXRlcnMnO1xuaW1wb3J0IHN1cGVyanNvbiBmcm9tICdzdXBlcmpzb24nO1xuXG5mdW5jdGlvbiBnZXRCYXNlVXJsKCkge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgcmV0dXJuICcnO1xuICByZXR1cm4gYGh0dHA6Ly9sb2NhbGhvc3Q6JHtwcm9jZXNzLmVudi5QT1JUID8/IDMwMDB9YDtcbn1cblxuZXhwb3J0IGNvbnN0IHRycGMgPSBjcmVhdGVUUlBDTmV4dDxBcHBSb3V0ZXI+KHtcbiAgY29uZmlnKG9wdHMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbGlua3M6IFtcbiAgICAgICAgaHR0cEJhdGNoTGluayh7XG4gICAgICAgICAgdXJsOiBgJHtnZXRCYXNlVXJsKCl9L2FwaS90cnBjYCxcbiAgICAgICAgICB0cmFuc2Zvcm1lcjogc3VwZXJqc29uLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfTtcbiAgfSxcbiAgc3NyOiBmYWxzZSxcbiAgdHJhbnNmb3JtZXI6IHN1cGVyanNvbixcbn0pOyJdLCJuYW1lcyI6WyJodHRwQmF0Y2hMaW5rIiwiY3JlYXRlVFJQQ05leHQiLCJzdXBlcmpzb24iLCJnZXRCYXNlVXJsIiwicHJvY2VzcyIsImVudiIsIlBPUlQiLCJ0cnBjIiwiY29uZmlnIiwib3B0cyIsImxpbmtzIiwidXJsIiwidHJhbnNmb3JtZXIiLCJzc3IiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/utils/trpc.ts\n");

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