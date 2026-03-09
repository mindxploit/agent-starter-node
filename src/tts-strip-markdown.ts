/** Emoji regex - matches emoji characters for removal before TTS. */
const EMOJI_RE = /\p{Emoji}/gu;

/** Strip markdown and emojis for TTS - avoids speaking links/emojis aloud. Matches LiveKit filter_markdown + filter_emoji. */
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(EMOJI_RE, '') // Remove emojis
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [Link Text](url) -> Link Text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // ![alt](url) -> alt
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1') // *italic* -> italic
    .replace(/`([^`]+)`/g, '$1') // `code` -> code
    .trim()
    .replace(/\s+/g, ' '); // collapse extra whitespace from emoji removal
}
