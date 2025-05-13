import "vitest"
import { Bindings } from "./types"

declare module "vitest" {
  export interface TestContext {
    bindings: Bindings
    mf: any
    fetchMock: any
  }
}
