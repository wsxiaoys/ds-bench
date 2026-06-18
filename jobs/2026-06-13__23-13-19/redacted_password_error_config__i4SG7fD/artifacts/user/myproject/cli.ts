import { type, ArkErrors } from "arktype";
import { signUpSchema } from "./src/validator.js";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", (err) => {
      reject(err);
    });
  });
}

function isSensitiveError(err: any): boolean {
  if (err && Array.isArray(err.path)) {
    return err.path.some((p: any) => p === "password" || p === "confirm" || p === "ssn");
  }
  return false;
}

function redactSensitiveData(val: any, sensitiveStrings: Set<string>): any {
  if (typeof val === "string") {
    let result = val;
    for (const sensitive of sensitiveStrings) {
      if (sensitive && result.includes(sensitive)) {
        result = result.split(sensitive).join("<redacted>");
      }
    }
    return result;
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactSensitiveData(item, sensitiveStrings));
  }
  if (val !== null && typeof val === "object") {
    const res: any = {};
    for (const key of Object.keys(val)) {
      if (key === "data" && isSensitiveError(val)) {
        res[key] = "<redacted>";
      } else if (key === "path") {
        res[key] = val[key];
      } else {
        res[key] = redactSensitiveData(val[key], sensitiveStrings);
      }
    }
    return res;
  }
  return val;
}

async function main() {
  try {
    const stdinContent = await readStdin();
    let inputPayload: any;
    try {
      inputPayload = JSON.parse(stdinContent);
    } catch (err) {
      console.log("INVALID: " + JSON.stringify({
        errors: [{ message: "Invalid JSON input" }]
      }));
      process.exit(0);
    }

    const result = signUpSchema(inputPayload);

    if (result instanceof ArkErrors) {
      // Formulate the full structured error JSON
      const plainErrorObj = {
        byPath: JSON.parse(JSON.stringify(result.byPath)),
        flatByPath: JSON.parse(JSON.stringify(result.flatByPath)),
        flatProblemsByPath: JSON.parse(JSON.stringify(result.flatProblemsByPath)),
        errors: JSON.parse(JSON.stringify(result))
      };

      // Collect raw sensitive values to redact from the output
      const sensitiveStrings = new Set<string>();
      if (inputPayload && typeof inputPayload === "object") {
        if (typeof inputPayload.password === "string" && inputPayload.password.length > 0) {
          sensitiveStrings.add(inputPayload.password);
        }
        if (typeof inputPayload.confirm === "string" && inputPayload.confirm.length > 0) {
          sensitiveStrings.add(inputPayload.confirm);
        }
        if (typeof inputPayload.ssn === "string" && inputPayload.ssn.length > 0) {
          sensitiveStrings.add(inputPayload.ssn);
        }
      }

      const redactedErrorObj = redactSensitiveData(plainErrorObj, sensitiveStrings);

      console.log("INVALID: " + JSON.stringify(redactedErrorObj));
      process.exit(0);
    } else {
      console.log("VALID");
      console.log(JSON.stringify(result));
      process.exit(0);
    }
  } catch (err: any) {
    console.log("INVALID: " + JSON.stringify({
      errors: [{ message: err?.message || "An unexpected error occurred" }]
    }));
    process.exit(0);
  }
}

main();
