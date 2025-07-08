import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const transcribeAudioPrompt = `
Transcribe the following audio file into text. The user is most likely speaking Finnish. You must respond with the transcription only, in a single JSON object with a "transcript" key. Do not include any additional text or formatting; the transcription must be plain text only. If the audio contains long pauses or silence, you should still transcribe the spoken content as accurately as possible. In other words, ignore any long pauses or silence in the audio and focus on the spoken content. Your transcription should be concise and accurate, capturing the essence of what was said without unnecessary embellishments or filler words. The transcription should be in the language spoken in the audio, which is often Finnish. Your output will be used to automatically fill an input field in a web application, so it must be clean and free of any additional formatting or text.
`.trim();

async function transcribeAudio(geminiApiKey: string, audioFile: File): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
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
      { text: transcribeAudioPrompt },
      { inlineData: { mimeType: "audio/wav", data: base64Data } },
    ],
    config: {
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
      temperature: 0.2,
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

function transcribeRoute(geminiApiKey: string): Route {
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
      const transcript = await transcribeAudio(geminiApiKey, audioFile);
      const result = JSON.stringify({ transcript });
      return new Response(result, { headers: { "content-type": "application/json" } });
    } catch (error) {
      console.error("Transcription error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  };
}

export { transcribeRoute };
