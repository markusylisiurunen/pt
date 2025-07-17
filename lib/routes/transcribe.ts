import { GoogleGenAI } from "@google/genai";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { readDocumentContentBySlug } from "../db/docs.ts";
import { KnownIngredients } from "../entities/ingredient.ts";

const transcribeAudioPrompt = `
Transcribe the following audio file into text. The user is most likely speaking Finnish or English.

You must respond with a single, raw JSON object with a "transcript" key. Do not include any additional text, formatting, or markdown. Your output must be only the JSON object.

The goal is a clean, readable transcription. Your output must:

1. **Omit all filler words** (e.g., "um", "uh", "niinku") and verbal tics.
2. **Ignore long pauses** and silence, focusing only on the core spoken content.
3. **Use appropriate basic punctuation** to form a coherent sentence or phrase.

The transcription will fill an input field in a personal trainer/food logging app. Therefore, pay extra attention to accurately transcribing any brand names, product names, or specific food items. You can use the following list of the user's saved food items to improve accuracy (especially for food and brand names):

<saved_food_items>
{{saved_food_items}}
</saved_food_items>

Your performance is analyzed using Word Error Rate (WER) against a "cleaned" ground truth transcription. This reference transcript has already had all filler words removed and correct punctuation inferred. Therefore, to achieve a low WER, you must precisely follow the cleaning rules above and perfectly capture the essential words, especially food and brand names.
`.trim();

async function transcribeAudio(
  db: DatabaseSync,
  geminiApiKey: string,
  audioFile: File,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  // read the known ingredients
  const knownIngredientsContent = readDocumentContentBySlug(db, "known-ingredients");
  const knownIngredients = KnownIngredients.safeParse(JSON.parse(knownIngredientsContent || "{}"));
  if (!knownIngredients.success) {
    return "Error: Failed to parse known ingredients document.";
  }
  // read the audio file into a base64 string
  const arrayBuffer = await audioFile.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binaryStr = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binaryStr += String.fromCharCode(uint8Array[i]);
  }
  const base64Data = btoa(binaryStr);
  // send the audio file to Gemini for transcription
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        text: transcribeAudioPrompt.replaceAll(
          "{{saved_food_items}}",
          JSON.stringify(
            knownIngredients.data.ingredients.map((i) => ({ name: i.name, brand: i.brand ?? "" })),
            null,
            2,
          ),
        ),
      },
      { inlineData: { mimeType: "audio/wav", data: base64Data } },
    ],
    config: {
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  // parse the response
  const responseSchema = z.object({ transcript: z.string() });
  const parsedResponse = responseSchema.safeParse(JSON.parse(response.text || "{}"));
  if (!parsedResponse.success) {
    throw new Error(`Transcription failed`);
  }
  return parsedResponse.data.transcript.trim();
}

interface Route {
  (req: Request): Response | Promise<Response>;
}

function transcribeRoute(db: DatabaseSync, geminiApiKey: string): Route {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    try {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as File;
      if (!audioFile) {
        return new Response("No audio file provided", { status: 400 });
      }
      const transcript = await transcribeAudio(db, geminiApiKey, audioFile);
      const result = JSON.stringify({ transcript });
      return new Response(result, { headers: { "content-type": "application/json" } });
    } catch (error) {
      console.error("Transcription error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  };
}

export { transcribeRoute };
