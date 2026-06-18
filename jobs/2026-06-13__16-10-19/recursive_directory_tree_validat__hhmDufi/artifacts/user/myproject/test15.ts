import { type } from "arktype";
try { type("number%1>0").assert("1"); console.log("'1' VALID"); } catch(e) { console.log("'1' INVALID", e.message); }
