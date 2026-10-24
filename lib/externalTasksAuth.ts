/**
 * External API authentication for tasks - uses Bearer token from environment variable.
 * This is separate from the cookie-based authentication used by the web UI.
 */

/**
 * Get the API key from environment variable.
 * This should be set in the hosting environment (e.g., Vercel).
 */
export function getExternalTasksApiKey(): string | null {
  return process.env.EXTERNAL_TASKS_API_KEY?.trim() || null;
}

/**
 * Get the webhook URL for pushing task changes to the home server (optional).
 */
export function getTasksWebhookUrl(): string | null {
  return process.env.TASKS_WEBHOOK_URL?.trim() || null;
}

/**
 * Verify that the provided Bearer token matches the configured API key.
 * @param authHeader The Authorization header value (e.g., "Bearer abc123")
 * @returns true if the token is valid, false otherwise
 */
export function verifyExternalApiAuth(authHeader: string | null): boolean {
  if (!authHeader) return false;
  
  const apiKey = getExternalTasksApiKey();
  if (!apiKey) {
    // If no API key is configured, external API is disabled
    return false;
  }
  
  // Check for "Bearer <token>" format
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  
  const providedToken = match[1];
  
  // Use constant-time comparison to prevent timing attacks
  return constantTimeEqual(providedToken, apiKey);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}
