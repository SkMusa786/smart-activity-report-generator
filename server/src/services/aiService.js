import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

function classifyGeminiError(error) {
  const status = Number(error?.status || error?.response?.status || error?.error?.code);
  let providerError;
  try {
    providerError = JSON.parse(error?.message || "");
  } catch {
    providerError = null;
  }
  const providerBody = providerError?.error || error?.error || error?.response?.data?.error;
  const message = providerBody?.message || error?.message || "Gemini description generation failed.";
  const details = providerBody?.details;
  const failure = new Error(message);
  failure.status = status || 500;
  failure.code = providerBody?.code;
  failure.providerStatus = providerBody?.status;
  failure.providerMessage = message;
  failure.details = details;
  if (status === 401 || status === 403) {
    failure.message = "Gemini authentication failed. Check GEMINI_API_KEY and Gemini API access for its project.";
    return failure;
  }
  if (status === 429) {
    failure.message = "Gemini quota or rate limit exceeded. Check the Gemini API account.";
    return failure;
  }
  if (status === 408 || status === 504 || /timeout/i.test(message)) {
    failure.message = "Gemini request timed out. Please try again later.";
    return failure;
  }
  if (status === 404 || /not found|model.*unavailable|model.*not found/i.test(message)) {
    failure.message = `Gemini model is unavailable: ${MODEL}. Set GEMINI_MODEL to a model returned by the API key's model list.`;
    return failure;
  }
  return failure;
}

export async function generateActivityDescription(imageBuffer) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is missing in server/.env");
  }

  const optimizedImage = await sharp(imageBuffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toBuffer();

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      apiVersion: "v1beta",
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        if (!response.ok) {
          let body = null;
          try {
            body = await response.clone().json();
          } catch {
            body = { message: "Non-JSON Gemini error response." };
          }
          const providerError = body?.error || {};
          console.error("Gemini provider diagnostic:", JSON.stringify({
            path: new URL(input).pathname,
            status: response.status,
            code: providerError.code,
            providerStatus: providerError.status,
            message: providerError.message,
            details: providerError.details
          }));
        }
        return response;
      }
    }
  });
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: "user",
        parts: [
          {
            text: "Analyze this photograph and return only a professional activity report description in 2 to 3 sentences. Use simple professional English. Describe only what is visibly supported. Do not invent dates, locations, results, or activities. If unclear, describe the visible scene objectively."
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: optimizedImage.toString("base64")
            }
          }
        ]
      }],
      config: {
        systemInstruction: "You are a professional activity report writer for college social service reports.",
        maxOutputTokens: 180,
        temperature: 0.2
      }
    });

    const description = response.text?.trim();
    if (!description) throw new Error("Gemini did not generate a description.");
    const sentences = description.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    if (sentences.length < 2 || sentences.length > 3) {
      throw new Error("Gemini generated an invalid description. Please try again.");
    }
    return description;
  } catch (error) {
    throw classifyGeminiError(error);
  }
}
