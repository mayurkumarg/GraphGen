import assert from "node:assert/strict";
import test from "node:test";
import CustomError from "../utils/customError.js";
import generateErContentWithRetry from "../controllers/diagramsGenerator/ER/erGenerationRetry.js";

test("retries provider 503 twice with exponential delays, then returns the response", async () => {
  let calls = 0;
  const delays = [];
  const result = await generateErContentWithRetry(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw Object.assign(new Error("503 UNAVAILABLE"), { status: 503 });
      }
      return { text: "generated output" };
    },
    { sleep: async (milliseconds) => delays.push(milliseconds) }
  );

  assert.deepEqual(result, { text: "generated output" });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [500, 1000]);
});

test("forwards the original provider status and message after the final 503", async () => {
  let calls = 0;
  const providerError = Object.assign(
    new Error("503 UNAVAILABLE: temporary provider overload"),
    { status: 503 }
  );

  await assert.rejects(
    generateErContentWithRetry(
      async () => {
        calls += 1;
        throw providerError;
      },
      { sleep: async () => {} }
    ),
    (error) => {
      assert.ok(error instanceof CustomError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.message, providerError.message);
      return true;
    }
  );

  assert.equal(calls, 3);
});

test("does not retry non-503 provider errors", async () => {
  let calls = 0;

  await assert.rejects(
    generateErContentWithRetry(async () => {
      calls += 1;
      throw Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 });
    }),
    (error) => {
      assert.ok(error instanceof CustomError);
      assert.equal(error.statusCode, 429);
      assert.equal(error.message, "429 RESOURCE_EXHAUSTED");
      return true;
    }
  );

  assert.equal(calls, 1);
});
