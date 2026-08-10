import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/poll.$id.tsx?tsr-split=errorComponent
var SplitErrorComponent = () => /* @__PURE__ */ jsxs("div", {
	className: "card",
	children: [
		/* @__PURE__ */ jsx("h2", { children: "Poll Not Found" }),
		/* @__PURE__ */ jsx("p", { children: "The poll you are looking for does not exist or has been deleted." }),
		/* @__PURE__ */ jsx("a", {
			href: "/",
			className: "btn",
			children: "Go Back Home"
		})
	]
});
//#endregion
export { SplitErrorComponent as errorComponent };
