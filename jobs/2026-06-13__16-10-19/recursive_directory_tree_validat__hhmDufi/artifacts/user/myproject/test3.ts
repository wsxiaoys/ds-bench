import { type } from "arktype";
try { type("string>0").assert(""); } catch (e) { console.log(e.message); }
