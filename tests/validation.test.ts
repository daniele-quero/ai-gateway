import { describe, expect, it } from "vitest";
import {
  validateChatRequest,
  validateCompleteRequest,
  validateEmbeddingsRequest,
} from "../netlify/functions/lib/validation.js";
import { GatewayError } from "../netlify/functions/lib/errors.js";

describe("validateChatRequest", () => {
  it("accepts a valid request", () => {
    const result = validateChatRequest({
      model: "auto:fast",
      messages: [{ role: "user", content: "Ciao" }],
      stream: true,
    });
    expect(result.model).toBe("auto:fast");
    expect(result.stream).toBe(true);
    expect(result.messages).toHaveLength(1);
  });

  it("rejects an empty messages array", () => {
    expect(() => validateChatRequest({ model: "x", messages: [] })).toThrow(GatewayError);
  });

  it("rejects an invalid role", () => {
    expect(() =>
      validateChatRequest({ model: "x", messages: [{ role: "root", content: "hi" }] }),
    ).toThrow(GatewayError);
  });

  it("accepts image_data with an allowed mime type", () => {
    const result = validateChatRequest({
      model: "auto:vision",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe" },
            { type: "image_data", mimeType: "image/png", data: "aGVsbG8=" },
          ],
        },
      ],
    });
    expect(result.messages[0]?.content).toHaveLength(2);
  });

  it("rejects a disallowed image mime type", () => {
    expect(() =>
      validateChatRequest({
        model: "auto:vision",
        messages: [
          {
            role: "user",
            content: [{ type: "image_data", mimeType: "image/gif", data: "aGk=" }],
          },
        ],
      }),
    ).toThrow(GatewayError);
  });
});

describe("validateCompleteRequest", () => {
  it("accepts input and system", () => {
    const result = validateCompleteRequest({
      model: "auto:fast",
      input: "Riassumi",
      system: "In italiano",
    });
    expect(result.input).toBe("Riassumi");
    expect(result.system).toBe("In italiano");
  });

  it("rejects missing input", () => {
    expect(() => validateCompleteRequest({ model: "x" })).toThrow(GatewayError);
  });
});

describe("validateEmbeddingsRequest", () => {
  it("normalizes a single string into an array", () => {
    const result = validateEmbeddingsRequest({ model: "auto:embedding", input: "solo" });
    expect(result.input).toEqual(["solo"]);
  });

  it("accepts an array of strings", () => {
    const result = validateEmbeddingsRequest({ model: "auto:embedding", input: ["a", "b"] });
    expect(result.input).toEqual(["a", "b"]);
  });

  it("rejects an empty input", () => {
    expect(() => validateEmbeddingsRequest({ model: "x", input: [] })).toThrow(GatewayError);
  });
});
