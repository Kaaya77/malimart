
// @model-version: managed in ./aiModels.ts (gemini-2.0-flash shut down 2026-06-01)
import { GoogleGenAI, Type } from "@google/genai";
import { getAI, proxiedMediaUrl } from './aiClient';
import { MODELS, safeJson } from './aiModels';
import { Product } from '../types';

/**
 * Utility for retrying failed AI requests with exponential backoff.
 */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> => {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            lastError = e;
            const errorMsg = e?.message || "";
            // Model-retired / bad-key errors are permanent; don't retry.
            if (errorMsg.includes('Requested entity was not found') || errorMsg.includes('API key not valid') || errorMsg.includes('is not found for API version')) {
                throw e;
            }

            // Don't retry if it's a 4xx error that isn't a rate limit
            if (e?.status >= 400 && e?.status < 500 && e?.status !== 429) {
                throw e;
            }

            if (i < maxRetries) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
};

export const generateWelcomeGreeting = async (name?: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const time = new Date().getHours();
        const period = time < 12 ? 'morning' : time < 17 ? 'afternoon' : 'evening';
        const namePart = name ? ` ${name}` : "";
        
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Generate a concise, punchy greeting (max 5 words) for a ${period} in English. 
            Format: "Greeting - Subtitle". 
            Example: "Good Morning${namePart} - Welcome to MaliMart". 
            Keep it professional and welcoming.`,
        });
        return response.text || "Welcome Back - Enjoy Shopping";
    }).catch(() => "Welcome Back - Enjoy Shopping");
};

export const generateProductDescription = async (productName: string, category: string, keywords: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODELS.FAST,
      contents: `Write a compelling, short e-commerce product description for a product named "${productName}" in the category "${category}". 
      Highlight these features: ${keywords}. 
      Tone: Professional, inviting, and high-end. Max 80 words. Use English exclusively.`,
    });
    return response.text || "Could not generate description.";
  }).catch(error => {
    console.error("Gemini API Error:", error);
    return "Error generating description. Please try again.";
  });
};

/**
 * Analyzes an uploaded product image to auto-fill the form.
 */
export const analyzeProductImage = async (imageBase64: string): Promise<{ name: string, category: string, tags: string[], description: string } | null> => {
    return withRetry(async () => {
        const ai = getAI();
        const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: `Analyze this product image for an e-commerce listing. 
                    Return ONLY a JSON object with:
                    - name: A professional, catchy product title (max 5 words).
                    - category: The best fitting category from [Fashion & Beauty, Food & Pantry, Handicrafts & Products, Electronics, Home & Living, Agriculture & Livestock, Construction & Hardware, Kids & Toys, Vehicles & Parts, Books & Stationery].
                    - tags: Array of 5 relevant SEO keywords.
                    - description: A sophisticated 2-sentence sales pitch.
                    Do not include any other text, markdown formatting, or explanations.` }
                ]
            }
        });
        
        let text = response.text?.trim() || "null";
        text = text.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '');
        
        return JSON.parse(text);
    }).catch(e => {
        console.error("Vision Analysis Error:", e);
        return null;
    });
};

export const suggestAttributes = async (name: string, category: string, description: string): Promise<{name: string, values: string[]}[]> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Suggest 2-3 appropriate product attributes (like Color, Size, Material) for a "${name}" in "${category}". 
            Description: "${description}".
            Return JSON array of objects with 'name' and 'values' (array of strings). 
            Example: [{"name": "Size", "values": ["S", "M", "L"]}, {"name": "Color", "values": ["Red", "Blue"]}]`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            values: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["name", "values"]
                    }
                }
            }
        });
        return JSON.parse(response.text?.trim() || "[]");
    }).catch(() => []);
};

export const generateSmartSKU = async (name: string, category: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Generate a professional, short SKU (Stock Keeping Unit) code for "${name}" in category "${category}". 
            Format: Uppercase, alphanumeric, 8-12 characters. Example: SHIRT-BLU-01. Return ONLY the string.`,
        });
        return response.text?.trim().replace(/[^A-Z0-9-]/g, '') || `SKU-${Date.now().toString().slice(-6)}`;
    }).catch(() => `SKU-${Date.now().toString().slice(-6)}`);
};

export const generateProductListing = async (name: string, imageBase64?: string): Promise<{ description: string, tags: string[], category?: string, subcategory?: string } | null> => {
    return withRetry(async () => {
        const ai = getAI();
        let parts: any[] = [];
        
        if (imageBase64) {
            const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } });
        }
        
        parts.push({ 
            text: `Generate a listing for product "${name}". Return JSON with:
            1. description: Professional sales copy (max 60 words).
            2. tags: 5 relevant SEO keywords.
            3. category: Best fit from [Fashion & Beauty, Food & Pantry, Handicrafts & Products, Electronics, Home & Living, Agriculture & Livestock, Construction & Hardware, Kids & Toys, Vehicles & Parts, Books & Stationery].
            4. subcategory: A specific subcategory type.
            Use English.` 
        });

        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        category: { type: Type.STRING },
                        subcategory: { type: Type.STRING }
                    },
                    required: ["description", "tags", "category"]
                }
            }
        });
        return JSON.parse(response.text?.trim() || "null");
    }).catch(e => {
        console.error("Listing Gen Error:", e);
        return null;
    });
};

export const translateToSwahili = async (text: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Translate the following product description to professional, appealing Swahili suitable for a Tanzanian marketplace. Keep the tone engaging. Input: "${text}"`,
        });
        return response.text || text;
    }).catch(() => text);
}

export const enhanceDescription = async (text: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Rewrite the following product description to make it more compelling, premium, and SEO-optimized. Focus on sensory details, craftsmanship, and benefits. Keep it under 100 words. Input: "${text}"`,
        });
        return response.text || text;
    }).catch(() => text);
}

export const moderateContent = async (name: string, description: string): Promise<{ isFlagged: boolean, reason: string }> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Analyze the following product name and description for any policy violations. Policies include: no hate speech, no illegal items, no explicit content, no misleading claims.
            Name: "${name}"
            Description: "${description}"
            
            Return ONLY a JSON object with this exact structure:
            {"isFlagged": boolean, "reason": "string explaining why if flagged, or empty string if not"}`,
            config: {
                responseMimeType: "application/json"
            }
        });
        try {
            const result = JSON.parse(response.text?.trim() || '{"isFlagged": false, "reason": ""}');
            return {
                isFlagged: !!result.isFlagged,
                reason: result.reason || ""
            };
        } catch (e) {
            return { isFlagged: false, reason: "" };
        }
    }).catch(() => ({ isFlagged: false, reason: "" }));
}

export const generateSocialCaption = async (imageBase64: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: "Generate a catchy, vibrant social media caption for this lifestyle photo for an e-commerce feed. Use English only. Max 20 words." }
                ]
            }
        });
        return response.text || "Loving the vibes! #MaliMart";
    }).catch(() => "Great finds! #MaliMart");
};

export const generateSocialPost = async (product: Product): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Generate a compelling, high-converting social media post for this product:
            Name: ${product.name}
            Price: ${product.price}
            Description: ${product.description || 'No description'}
            
            Include:
            1. Engaging hook.
            2. Product benefits.
            3. Call to action.
            4. Relevant hashtags.
            Tone: Enthusiastic and sales-driven. Max 100 words. Use English.`,
        });
        return response.text || `Check out ${product.name}! Get yours now at ${product.price}. #MaliMart`;
    }).catch(() => `Check out ${product.name}! Get yours now at ${product.price}. #MaliMart`);
};

export const mapCSVColumnsToSchema = async (csvHeaders: string[]): Promise<Record<string, string>> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Map these CSV headers to our database schema.
            CSV Headers: ${JSON.stringify(csvHeaders)}
            Database Schema: { name: string, price: number, stock: number, category: string }
            Return JSON object: { "csvHeader": "schemaField" }.
            Example: { "Product Name": "name", "Price (TZS)": "price", "Qty": "stock", "Dept": "category" }`,
            config: {
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(response.text?.trim() || "{}");
    }).catch(() => ({}));
};

export const suggestProductPrice = async (productName: string, category: string): Promise<number> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Suggest a competitive premium price in Tanzanian Shillings (TZS) for this product: "${productName}" in category "${category}". Return ONLY the number. Example: 45000`,
        });
        const num = parseInt(response.text?.replace(/[^0-9]/g, '') || "0");
        return num > 0 ? num : 0;
    }).catch(() => 0);
}

export const generateTags = async (name: string, description: string): Promise<string[]> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Generate 8 relevant SEO tags for a product named "${name}". Description: "${description}". Return ONLY a comma-separated list of tags. Example: "shoes, leather, mens fashion, summer, durable"`,
        });
        return (response.text || "").split(',').map(s => s.trim()).filter(s => s.length > 0);
    }).catch(() => []);
};

export const generateProductImage = async (prompt: string): Promise<string | null> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODELS.IMAGE,
      contents: {
          parts: [{ text: `High-end professional e-commerce product photography of ${prompt}. Studio lighting, clean minimal background, 8k resolution, photorealistic, center aligned, premium commercial quality.` }]
      },
      config: { responseModalities: ['IMAGE', 'TEXT'] }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  }).catch(error => {
    console.error("Gemini Image Gen Error:", error);
    return null;
  });
};

export const refineProductImage = async (imageInput: string, instruction: string): Promise<string | null> => {
    return withRetry(async () => {
        const ai = getAI();
        let mimeType = 'image/jpeg';
        let cleanBase64 = imageInput;

        if (imageInput.startsWith('http')) {
            const fetchRes = await fetch(imageInput);
            const blob = await fetchRes.blob();
            mimeType = blob.type || 'image/jpeg';
            const buffer = await blob.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            cleanBase64 = btoa(binary);
        } else if (imageInput.includes('base64,')) {
            const parts = imageInput.split('base64,');
            cleanBase64 = parts[1];
            const match = parts[0].match(/:(.*?);/);
            if (match) mimeType = match[1];
        } else {
            cleanBase64 = imageInput;
        }

        const response = await ai.models.generateContent({
            model: MODELS.IMAGE,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: cleanBase64 } },
                    { text: `Edit this image to improve its e-commerce appeal. specifically: ${instruction}. Keep it high resolution and photorealistic.` }
                ]
            },
            config: { responseModalities: ['IMAGE', 'TEXT'] }
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) return null;
        for (const part of parts) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    }).catch(e => {
        console.error("Refine Error:", e);
        return null;
    });
};

export const generateMarketingVideo = async (productName: string, description: string): Promise<string | null> => {

    return withRetry(async () => {
        const ai = getAI();
        let operation = await ai.models.generateVideos({
            model: MODELS.VIDEO,
            prompt: `Cinematic commercial for ${productName}. ${description}. Professional lighting, 4k, smooth camera movement, highly detailed.`,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5s
            operation = await ai.operations.getVideosOperation({operation: operation});
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return null;

        // Fetch the actual video blob
        const res = await fetch(proxiedMediaUrl(downloadLink));
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    });
};

export const generateRecipesFromCart = async (ingredients: string[]): Promise<any[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODELS.SMART,
      contents: `Suggest 3 authentic recipes using: ${ingredients.join(', ')}. Return JSON. Use English for all text.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.STRING },
              difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] }
            },
            required: ["title", "ingredients", "instructions", "difficulty"]
          }
        }
      }
    });
    return JSON.parse(response.text?.trim() || "[]");
  }).catch(() => []);
};

export const analyzeImageForSearch = async (imageBase64: string): Promise<string[]> => {
    return withRetry(async () => {
        const ai = getAI();
        const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: "Analyze this image and list 5 descriptive keywords in English. Return ONLY comma-separated keywords." }
                ]
            }
        });
        return (response.text || "").split(',').map(s => s.trim()).filter(s => s.length > 0);
    }).catch(() => []);
};

export const identifyTrendingProduct = async (products: Product[]): Promise<{ id: string, reason: string } | null> => {
  return withRetry(async () => {
    const ai = getAI();
    const candidates = products.filter(p => p.stock > 0).slice(0, 30);
    if (candidates.length === 0) return null;

    const response = await ai.models.generateContent({
      model: MODELS.SMART,
      contents: `Pick the most appealing product for a flash sale: ${JSON.stringify(candidates.map(p => ({id: p.id, name: p.name})))}. Return JSON: { "id": "uuid", "reason": "short pitch in English" }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: { id: { type: Type.STRING }, reason: { type: Type.STRING } },
            required: ["id", "reason"]
        }
      }
    });
    return JSON.parse(response.text?.trim() || "null");
  }).catch(() => null);
}

export const getAssistantResponse = async (query: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.SMART,
            contents: query,
            config: {
                systemInstruction: "You are MaliMart AI, a helpful shopping assistant. Communicate clearly in English.",
            }
        });
        return response.text || "I am here to help.";
    }).catch(() => "Sorry, I'm having trouble connecting to my brain right now. Please try again later.");
};

export const generateRecipeCardImage = async (title: string): Promise<string | null> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.IMAGE,
            contents: {
                parts: [{ text: `Gourmet dish: ${title}, top-down photography, vibrant colors, fresh ingredients, 4k` }]
            },
            config: { imageConfig: { aspectRatio: '16:9' } }
        });
        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) return null;
        for (const part of parts) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    }).catch(() => null);
}

export const generateSellerReplies = async (context: string): Promise<string[]> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `You are a professional seller on MaliMart. Generate 3 short, polite, and distinct quick-reply options for this customer message: "${context}". Keep them under 10 words. Return JSON array of strings.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return JSON.parse(response.text?.trim() || "[]");
    }).catch(() => ["Yes, it is available.", "I can ship this today.", "Let me check the stock."]);
};

export const analyzeConversation = async (messages: string[]): Promise<{ sentiment: number, intent: string, suggestion: string } | null> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.SMART,
            contents: `Analyze this buyer-seller conversation from the seller's perspective. 
            History: ${JSON.stringify(messages.slice(-5))}
            
            Return JSON with:
            - sentiment: number between 0 (hostile) and 100 (ready to buy).
            - intent: "Browsing", "Negotiating", "Ready to Buy", "Support", or "Complaint".
            - suggestion: A tactical next step for the seller (max 10 words).
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sentiment: { type: Type.NUMBER },
                        intent: { type: Type.STRING },
                        suggestion: { type: Type.STRING }
                    },
                    required: ["sentiment", "intent", "suggestion"]
                }
            }
        });
        return JSON.parse(response.text?.trim() || "null");
    }).catch(() => null);
};

export const analyzeDispute = async (reason: string, description: string): Promise<{ suggestion: string, riskScore: number, recommendedAction: string } | null> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.SMART,
            contents: `Analyze this e-commerce dispute.
            Reason: ${reason}
            Description: ${description}
            
            Return JSON with:
            - suggestion: A short, professional summary/analysis of the dispute (max 20 words).
            - riskScore: number between 0 (low risk) and 100 (high risk of fraud/severe issue).
            - recommendedAction: "refund_buyer" or "release_funds".
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestion: { type: Type.STRING },
                        riskScore: { type: Type.NUMBER },
                        recommendedAction: { type: Type.STRING }
                    },
                    required: ["suggestion", "riskScore", "recommendedAction"]
                }
            }
        });
        return JSON.parse(response.text?.trim() || "null");
    }).catch(() => null);
};

export const refineMessage = async (draft: string, tone: 'professional' | 'persuasive' | 'friendly' = 'professional'): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: MODELS.FAST,
            contents: `Rewrite the following draft message for a seller to a buyer. 
            Draft: "${draft}"
            Tone: ${tone}
            Keep it concise and natural for a chat interface.`,
        });
        return response.text || draft;
    }).catch(() => draft);
};
