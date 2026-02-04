import type { ZodSchema } from "zod"
import { getErrors } from "./errors"
import { printMessage } from "./print-message"

/**
 * Validates a config object against a Zod schema.
 * Logs user-friendly error messages if validation fails.
 *
 * @param config - The config object to validate
 * @param schema - The Zod schema to validate against
 * @returns `true` if validation failed (has error), `false` if validation passed
 */
export function validateConfig<T>(
  config: unknown,
  schema: ZodSchema<T>,
): boolean {
  const result = schema.safeParse(config)
  const hasErrors = !result.success
  if (hasErrors) {
    const mappedErrors = getErrors(result.error)
    if (mappedErrors.length > 0) {
      // Use user-friendly mapped error messages when available
      for (const error of mappedErrors) {
        console.error(printMessage(error as string))
      }
    } else {
      // Fallback to Zod's built-in error message for unmapped errors
      console.error(printMessage(result.error.message))
    }
  }
  return hasErrors
}
