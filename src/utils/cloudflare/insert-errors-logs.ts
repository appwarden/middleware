import { ZodError } from "zod"
import { MiddlewareContext } from "../../types"
import { getErrors } from "../errors"
import { printMessage } from "../print-message"

export const insertErrorLogs = async (
  context: MiddlewareContext,
  error: ZodError,
) => {
  const errors = getErrors(error)
  for (const err of errors) {
    console.log(printMessage(err as string))
  }

  return new HTMLRewriter()
    .on("body", {
      element: (elem) => {
        elem.append(
          `<script>
            ${errors
              .map((err) => `console.error(\`${printMessage(err as string)}\`)`)
              .join("\n")}
          </script>`,
          { html: true },
        )
      },
    })
    .transform(await fetch(context.request))
}
