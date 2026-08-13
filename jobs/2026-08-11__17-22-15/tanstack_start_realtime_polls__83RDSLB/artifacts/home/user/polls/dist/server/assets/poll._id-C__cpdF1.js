import { jsxs, jsx } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
const SplitErrorComponent = () => /* @__PURE__ */ jsxs("div", { children: [
  /* @__PURE__ */ jsx("h2", { children: "Poll Not Found" }),
  /* @__PURE__ */ jsx("p", { children: "The poll you are looking for does not exist or has been deleted." }),
  /* @__PURE__ */ jsx(Link, { to: "/", style: {
    color: "#007bff"
  }, children: "Go back to home page" })
] });
export {
  SplitErrorComponent as errorComponent
};
