import { Gateway } from "encore.dev/api";
import { myAuth } from "./auth";

export const gateway = new Gateway({ authHandler: myAuth });
