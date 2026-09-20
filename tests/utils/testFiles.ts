/**
 * Minimal in-memory files with real magic bytes (headers), so that
 * content-based type detection (file-type) accepts them in tests.
 */

const pad = (bytes: number[], length = 64): Uint8Array => {
  const result = new Uint8Array(length);
  result.set(bytes);
  return result;
};

export const makeJpegFile = (name = "test.jpg"): File =>
  new File([pad([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])], name, {
    type: "image/jpeg",
  });

export const makePngFile = (name = "test.png"): File =>
  new File(
    [pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])],
    name,
    { type: "image/png" },
  );

export const makePdfFile = (name = "test.pdf"): File =>
  new File([new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")], name, {
    type: "application/pdf",
  });
