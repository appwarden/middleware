/**
 * Escapes a string for safe insertion into a JavaScript template literal context.
 *
 * Protects against:
 * - Template literal injection via ${ }
 * - Script tag breaking via </script>
 * - Backslash, quote, and backtick escaping
 * - Null byte injection
 *
 * @param str - The string to escape
 * @returns The escaped string safe for template literal insertion
 */
const addSlashes = (str: string) =>
  str
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/`/g, "\\`") // Escape backticks
    .replace(/\$/g, "\\$") // Escape $ to prevent ${} interpolation
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/\u0000/g, "\\0") // Escape null bytes
    .replace(/<\/script>/gi, "<\\/script>") // Escape closing script tags

export const printMessage = (message: string) =>
  `[@appwarden/middleware] ${addSlashes(message)}`
