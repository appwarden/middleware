import * as cheerio from "cheerio"
import { Bindings } from "../types"

export const validBindings: Bindings = {
  LOCK_PAGE_SLUG: "/maintenance",
  APPWARDEN_API_TOKEN: "123",
  CSP_MODE: "report-only",
  CSP_DIRECTIVES: `{ "defaultSrc": ["{{nonce}}"] }`,
  DEBUG: true,
}

export const getBindings = (
  bindings: Partial<Bindings> = {}
): Bindings => ({
  ...validBindings,
  ...bindings,
})

export const getNonce = ($: cheerio.CheerioAPI, el: any) => $(el).attr("nonce")

// HTML response for testing CSP nonce injection
export const mockOriginResponse = `
<html>
  <!--
    This is a mock response from appwarden.io homepage.
    It tests that the nonce attribute is being added to script tags.
  -->
  <script src="a.com"></script>
  <script src="b.com"></script>
  <script src="c.com"></script>
  <script src="d.com"></script>
</html>`
