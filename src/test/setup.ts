import { afterEach, beforeEach } from "vitest"
import { getFetchMock, setupFetchMock } from "./fetch-mocks"

beforeEach(async (ctx) => {
  const fetchMock = getFetchMock()
  setupFetchMock(fetchMock)
  ctx.fetchMock = fetchMock
})

afterEach((ctx) => {
  // We don't need to check for pending interceptors since we're using persist()
  // Close the mock agent
  ctx.fetchMock.close()
})
