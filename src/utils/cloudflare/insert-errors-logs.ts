import { ZodError } from "zod"
import { MiddlewareContext } from "../../types"
import { getErrors } from "../errors"
import { printMessage } from "../print-message"

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

export const insertErrorLogs = async (
  context: MiddlewareContext,
  error: ZodError,
) => {
  const errors = getErrors(error)
  for (const err of errors) {
    console.log(printMessage(err as string))
  }

  const safeErrors = JSON.stringify(
    errors.map((err) => printMessage(err as string)),
  )
  const escapedErrors = htmlEscape(safeErrors)

  // Clone the request so that fetch() operates on a copy and does not
  // consume the original request body, which may be needed elsewhere
  // in the middleware pipeline.
  return new HTMLRewriter()
    .on("body", {
      element: (elem) => {
        elem.setAttribute("data-appwarden-logs", escapedErrors)
        elem.append(
          `<script>const logs=JSON.parse(document.body.getAttribute("data-appwarden-logs"));for(const log of logs){console.error(log)}</script>`,
          { html: true },
        )
      },
    })
    .transform(await fetch(context.request.clone()))
}
