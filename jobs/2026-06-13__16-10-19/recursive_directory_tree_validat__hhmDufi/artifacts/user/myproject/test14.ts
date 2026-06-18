import { type } from "arktype";
try { type("number%1>0").assert(1.5); console.log("1.5 VALID"); } catch(e) { console.log("1.5 INVALID", e.message); }
try { type("number%1>0").assert(1); console.log("1 VALID"); } catch(e) { console.log("1 INVALID", e.message); }
try { type("number%1>0").assert(-1); console.log("-1 VALID"); } catch(e) { console.log("-1 INVALID", e.message); }
try { type("number%1>0").assert(0); console.log("0 VALID"); } catch(e) { console.log("0 INVALID", e.message); }
