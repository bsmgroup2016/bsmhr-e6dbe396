import { describe, expect, it } from "bun:test";
import { integrationPresetModel } from "./ocr-models";

describe("OCR model selections", () => {
  it("selects Gemini 4 Carbon for OCR", () => {
    expect(integrationPresetModel("ocr", "Gemini", "gemini-3.1-pro-preview")).toBe("gemini-4-carbon");
  });
  it("selects GPT 6.2 Sol for OCR", () => {
    expect(integrationPresetModel("ocr", "OpenAI", "gpt-5.5")).toBe("gpt-6.2-sol");
  });
  it("leaves chatbot models unchanged", () => {
    expect(integrationPresetModel("chatbot", "Gemini", "gemini-3.1-pro-preview")).toBe("gemini-3.1-pro-preview");
    expect(integrationPresetModel("chatbot", "OpenAI", "gpt-5.5")).toBe("gpt-5.5");
  });
});