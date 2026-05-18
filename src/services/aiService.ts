import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeContent = async (content: string) => {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following content for hate speech, spam, or inappropriate language. Return a JSON object with 'is_flagged' (boolean), 'reason' (string), and 'confidence' (number). Content: "${content}"`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    is_flagged: { type: Type.BOOLEAN },
                    reason: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                }
            }
        }
    });
    return JSON.parse(response.text || '{}');
};

export const extractDocumentData = async (documentBase64: string) => {
    const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [
            { inlineData: { mimeType: "image/jpeg", data: documentBase64 } },
            { text: "Extract the Business Registration Number, TIN, and Owner Name from this document. Return JSON." }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    business_reg_no: { type: Type.STRING },
                    tin_number: { type: Type.STRING },
                    owner_name: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text || '{}');
};
