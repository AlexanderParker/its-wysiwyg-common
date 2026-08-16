import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The component tests need a DOM. The logic tests do not care which
    // environment they run in, so one setting covers the suite.
    environment: "jsdom",
  },
});
