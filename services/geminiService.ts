
import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeStudentReason = async (reason: string, description: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI analysis unavailable (Missing API Key).";

  try {
    const prompt = `
      You are a guidance counselor assistant. Analyze the following student request.
      Reason Category: ${reason}
      Description: ${description}

      Please provide a concise analysis in the following format:
      **Summary**: [One sentence summary]
      **Urgency**: [Low/Medium/High] based on the emotional content.
      **Key Discussion Points**: 
      - [Point 1]
      - [Point 2]
      
      Keep it professional, empathetic, and strictly for the counselor's internal use.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating analysis. Please try again later.";
  }
};

export const getStudentSelfHelp = async (reason: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Self-help tips unavailable.";

  try {
    const prompt = `
      A student is waiting for a counseling appointment with the reason: "${reason}".
      Provide 3 quick, actionable, and safe self-care tips they can try right now while they wait. 
      Keep the tone warm, validating, and calming. 
      Do not give medical advice.
      Format as a simple HTML list using <ul> and <li> tags only, no markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No tips available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Tips unavailable at the moment.";
  }
};
