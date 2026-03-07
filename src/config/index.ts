import fs from "fs";
import path from "path";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/**
 * Resolve credential file path.
 * If a base64 env var is set (for Railway), decode it to a temp file.
 * Otherwise, use the file path env var.
 */
function resolveCredentialPath(
  base64EnvKey: string,
  filePathEnvKey: string,
): string {
  const base64 = process.env[base64EnvKey];
  if (base64) {
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const dir = path.join(process.cwd(), "credentials");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${base64EnvKey.toLowerCase()}.json`);
    fs.writeFileSync(filePath, decoded);
    return filePath;
  }
  return required(filePathEnvKey);
}

export const config = {
  line: {
    channelAccessToken: required("LINE_CHANNEL_ACCESS_TOKEN"),
    channelSecret: required("LINE_CHANNEL_SECRET"),
  },
  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
  },
  google: {
    calendarId: required("GOOGLE_CALENDAR_ID"),
    serviceAccountKeyPath: resolveCredentialPath(
      "GOOGLE_SA_KEY_BASE64",
      "GOOGLE_SERVICE_ACCOUNT_KEY_PATH",
    ),
  },
  firebase: {
    projectId: required("FIREBASE_PROJECT_ID"),
    serviceAccountKeyPath: resolveCredentialPath(
      "FIREBASE_SA_KEY_BASE64",
      "FIREBASE_SERVICE_ACCOUNT_KEY_PATH",
    ),
  },
  port: parseInt(optional("PORT", "3000"), 10),
};
