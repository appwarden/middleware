import { MockAgent } from "undici"

import "vitest"

declare module "vitest" {
  export interface TestContext {
    fetchMock: MockAgent
  }
}
