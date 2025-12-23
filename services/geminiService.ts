
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getBossFlavor = async (wave: number): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are the narrator of an epic elemental tower defense game. The player is facing Wave ${wave}, which contains a massive boss. Briefly (max 20 words) describe this boss threat.`,
    });
    return response.text || "A gargantuan shadow looms over the horizon...";
  } catch (error) {
    return "The earth trembles as a titan approaches!";
  }
};
