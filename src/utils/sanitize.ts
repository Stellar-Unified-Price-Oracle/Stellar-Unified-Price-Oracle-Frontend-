const MAX_SEARCH_LENGTH = 100

const CONTROL_CHARS = new RegExp(
  '[' +
    String.fromCharCode(0) +
    '-' +
    String.fromCharCode(8) +
    String.fromCharCode(11) +
    String.fromCharCode(12) +
    String.fromCharCode(14) +
    '-' +
    String.fromCharCode(31) +
    String.fromCharCode(127) +
    ']',
  'g',
)

/** Strips HTML tags, removes control characters, and enforces a max length on user search input. */
export function sanitizeSearchInput(input: string): string {
  return input.replace(/<[^>]*>/g, '').replace(CONTROL_CHARS, '').slice(0, MAX_SEARCH_LENGTH)
}
