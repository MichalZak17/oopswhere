// Prints a fresh SESSION_SECRET (32 random bytes, base64url).
import { randomBytes } from "node:crypto";
console.log(randomBytes(32).toString("base64url"));
