import { getAuthData as _getAuthData } from "encore.dev/internal/codegen/auth";
import { myAuth as _auth_myAuth } from "../../../src/auth.js";

export type AuthData = Awaited<ReturnType<typeof _auth_myAuth>>;

export function getAuthData(): AuthData | null {
    return _getAuthData()
}

declare module "encore.dev/api" {
  interface CallOpts {
    authData?: AuthData;
  }
}

