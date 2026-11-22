import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedBody } from "../../src/lib/uploads/bounded-body";

function streamedRequest(chunks: number[], length?: string): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size).fill(1));
      controller.close();
    },
  });
  return new Request("http://localhost/upload", {
    method: "POST", body: stream, duplex: "half",
    headers: length === undefined ? {} : { "content-length": length },
  } as RequestInit & { duplex: "half" });
}

test("multipart body limits do not depend on a reliable Content-Length", async () => {
  const max = 100;
  assert.deepEqual(await readBoundedBody(streamedRequest([40, 40]), max), { ok: true, bytes: new Uint8Array(80).fill(1) });
  assert.deepEqual(await readBoundedBody(streamedRequest([80, 21]), max), { ok: false, status: 413 });
  assert.deepEqual(await readBoundedBody(streamedRequest([80, 21], "1"), max), { ok: false, status: 413 });
  assert.deepEqual(await readBoundedBody(streamedRequest([1], "101"), max), { ok: false, status: 413 });
  assert.deepEqual(await readBoundedBody(streamedRequest([1], "invalid"), max), { ok: false, status: 400 });
});
