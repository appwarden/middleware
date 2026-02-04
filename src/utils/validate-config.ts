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
    for (const error of getErrors(result.error)) {
      console.error(printMessage(error as string))
    }
  }
  return hasErrors
}
