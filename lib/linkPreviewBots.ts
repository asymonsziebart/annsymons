/** User-agents used by iMessage, Slack, Facebook, etc. when fetching link previews. */
const LINK_PREVIEW_BOT =
  /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|pinterest|applebot|embedly|redditbot|quora link preview|preview/i;

export function isLinkPreviewBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return LINK_PREVIEW_BOT.test(userAgent);
}
