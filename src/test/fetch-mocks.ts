import { MockAgent, setGlobalDispatcher } from "undici"

const originResponse = `
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

export const getFetchMock = () =>
  new MockAgent({
    strictContentLength: false,
  })

export const setupFetchMock = (fetchMock: MockAgent) => {
  setGlobalDispatcher(fetchMock)
  fetchMock.enableNetConnect("localhost")
  return fetchMock
}

export const fetchMocks = {
  appwarden: {
    check: (
      fetchMock: MockAgent,
      response: (opts: any) => Promise<Partial<any>> = async () => ({}),
    ) => {
      const mockPool = fetchMock.get("https://staging-bot-gateway.appwarden.io")
      mockPool
        .intercept({
          method: "POST",
          path: `/v1/status/check`,
        })
        .reply(
          200,
          async () => {
            return { json: await response({}) }
          },
          {
            headers: { "content-type": "application/json" },
          },
        )
      return mockPool
    },
  },
  origin: {
    view: (fetchMock: MockAgent, times = 1) => {
      const mockPool = fetchMock.get("https://appwarden.io")

      // Create a mock that will be consumed by the test
      mockPool
        .intercept({
          method: "GET",
          path: "/",
        })
        .reply(200, originResponse, {
          headers: { "content-type": "text/html" },
        })
        .persist() // Make it persistent so it can be called multiple times

      return mockPool
    },
  },
}
