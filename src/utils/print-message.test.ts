import { describe, expect, it } from "vitest"
import { printMessage } from "./print-message"

describe("printMessage", () => {
  describe("basic functionality", () => {
    it("should add prefix to message", () => {
      const result = printMessage("test message")
      expect(result).toBe("[@appwarden/middleware] test message")
    })

    it("should handle empty string", () => {
      const result = printMessage("")
      expect(result).toBe("[@appwarden/middleware] ")
    })
  })

  describe("security: template literal injection protection", () => {
    it("should escape ${} template literal interpolation", () => {
      const result = printMessage("${alert('xss')}")
      expect(result).toBe("[@appwarden/middleware] \\${alert(\\'xss\\')}")

      // Verify it doesn't execute when used in template literal
      const testTemplate = `console.error(\`${result}\`)`
      expect(testTemplate).toContain("\\${alert")
    })

    it("should escape $ character", () => {
      const result = printMessage("Price: $100")
      expect(result).toBe("[@appwarden/middleware] Price: \\$100")
    })

    it("should escape complex template literal injection attempts", () => {
      const result = printMessage("${process.env.SECRET}")
      expect(result).toBe("[@appwarden/middleware] \\${process.env.SECRET}")
    })

    it("should escape nested template literal attempts", () => {
      const result = printMessage("${`${alert(1)}`}")
      expect(result).toBe("[@appwarden/middleware] \\${\\`\\${alert(1)}\\`}")
    })
  })

  describe("security: script tag breaking protection", () => {
    it("should escape </script> tag", () => {
      const result = printMessage("</script><script>alert('xss')</script>")
      expect(result).toBe(
        "[@appwarden/middleware] <\\/script><script>alert(\\'xss\\')<\\/script>",
      )
    })

    it("should escape </script> case-insensitively", () => {
      const result = printMessage("</SCRIPT>")
      // The regex replaces case-insensitively but outputs lowercase
      expect(result).toBe("[@appwarden/middleware] <\\/script>")
    })

    it("should escape </ScRiPt> mixed case", () => {
      const result = printMessage("</ScRiPt>")
      // The regex replaces case-insensitively but outputs lowercase
      expect(result).toBe("[@appwarden/middleware] <\\/script>")
    })
  })

  describe("security: quote and backtick escaping", () => {
    it("should escape backticks", () => {
      const result = printMessage("test `backtick` message")
      expect(result).toBe("[@appwarden/middleware] test \\`backtick\\` message")
    })

    it("should escape single quotes", () => {
      const result = printMessage("test 'quote' message")
      expect(result).toBe("[@appwarden/middleware] test \\'quote\\' message")
    })

    it("should escape double quotes", () => {
      const result = printMessage('test "quote" message')
      expect(result).toBe('[@appwarden/middleware] test \\"quote\\" message')
    })

    it("should escape all quote types together", () => {
      const result = printMessage(`test "double" 'single' \`backtick\``)
      expect(result).toBe(
        `[@appwarden/middleware] test \\"double\\" \\'single\\' \\\`backtick\\\``,
      )
    })
  })

  describe("security: backslash escaping", () => {
    it("should escape backslashes", () => {
      const result = printMessage("test\\message")
      expect(result).toBe("[@appwarden/middleware] test\\\\message")
    })

    it("should escape multiple backslashes", () => {
      const result = printMessage("test\\\\message")
      expect(result).toBe("[@appwarden/middleware] test\\\\\\\\message")
    })

    it("should handle backslash before special characters", () => {
      const result = printMessage("test\\$message")
      expect(result).toBe("[@appwarden/middleware] test\\\\\\$message")
    })
  })

  describe("security: null byte protection", () => {
    it("should escape null bytes", () => {
      const result = printMessage("test\u0000message")
      expect(result).toBe("[@appwarden/middleware] test\\0message")
    })
  })

  describe("security: combined attack vectors", () => {
    it("should handle multiple attack vectors together", () => {
      const malicious = `</script><script>alert(\`\${document.cookie}\`)</script>`
      const result = printMessage(malicious)
      expect(result).toBe(
        `[@appwarden/middleware] <\\/script><script>alert(\\\`\\\${document.cookie}\\\`)<\\/script>`,
      )
    })

    it("should handle realistic error message with special characters", () => {
      const message = `Failed to parse 'CSP_DIRECTIVES'. Value: {"script-src": ["'self'"]}`
      const result = printMessage(message)
      expect(result).toContain("[@appwarden/middleware]")
      expect(result).toContain("\\'CSP_DIRECTIVES\\'")
      expect(result).toContain('\\"script-src\\"')
      expect(result).toContain("[\\\"\\'self\\'\\\"]")
    })

    it("should prevent script execution when inserted into template literal", () => {
      const malicious = "${alert('xss')}</script><script>alert('xss2')"
      const escaped = printMessage(malicious)

      // Simulate how it's used in insert-errors-logs.ts
      const scriptTag = `<script>console.error(\`${escaped}\`)</script>`

      // Verify the malicious code is escaped and won't execute
      expect(scriptTag).toContain("\\${alert")
      expect(scriptTag).toContain("<\\/script>")
      // The $ should be escaped, preventing interpolation
      expect(scriptTag).not.toContain("${alert('xss')}")
      // The </script> should be escaped, preventing tag breaking
      expect(scriptTag).not.toContain("</script><script>")
    })
  })
})
