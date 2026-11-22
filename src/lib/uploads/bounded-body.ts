/**
 * Read an HTTP request body without trusting Content-Length. This bounds the
 * multipart parser's input even for chunked, missing or misleading headers.
 */
export type BoundedBodyResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 413 };

export async function readBoundedBody(request: Request, maximumBytes: number): Promise<BoundedBodyResult> {
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) return { ok: false, status: 400 };
    if (Number(length) > maximumBytes) return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        // Do not wait for the rest of an oversized network upload.
        void reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { ok: true, bytes };
}
