import { GoogleAuth } from "google-auth-library";

const DEFAULT_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

let authClient: GoogleAuth | null = null;

function getAuthClient() {
  if (!authClient) {
    authClient = new GoogleAuth({
      scopes: DEFAULT_SCOPES,
    });
  }
  return authClient;
}

export async function getGoogleAccessToken(
  scopes: string[] = DEFAULT_SCOPES
): Promise<string> {
  const client = getAuthClient();
  const tokenClient = await client.getClient();
  const token = await tokenClient.getAccessToken();

  if (!token.token) {
    throw new Error("Failed to obtain Google access token");
  }

  return token.token;
}

export async function getGoogleProjectId(): Promise<string> {
  const fromEnv = process.env.GCP_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const projectId = await getAuthClient().getProjectId();
  if (!projectId) {
    throw new Error("GCP project id is not configured");
  }
  return projectId;
}

export function isGcpConfigured(): boolean {
  return Boolean(process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT);
}
