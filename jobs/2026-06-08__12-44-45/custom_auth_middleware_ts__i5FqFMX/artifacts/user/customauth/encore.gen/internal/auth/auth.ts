import { getAuthData as _getAuthData } from "encore.dev/internal/codegen/auth";
import { myAuthHandler as _auth_myAuthHandler } from "../../../auth.js";

export type AuthData = Awaited<ReturnType<typeof _auth_myAuthHandler>>;

export function getAuthData(): AuthData | null {
    return _getAuthData()
}

declare module "encore.dev/api" {
  interface CallOpts {
    authData?: AuthData;
  }
}

