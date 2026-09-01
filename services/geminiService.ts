
// @model-version: managed in ./aiModels.ts (gemini-2.0-flash shut down 2026-06-01)
import { GoogleGenAI, Type } from "@google/genai";
import { getAI } from './aiClient';
import { MODELS, IMAGE_MODEL_CHAIN, safeJson } from './aiModels';
import { canRequest, on429, blockedFor } from './aiRateLimit';
import { Product } from '../types';

class RateLimitError extends Error {
  constructor(model: string, waitSec: number) {
    super(`AI model ${model} is rate-limited. Try again in ${waitSec}s.`);
    this.name = 'RateLimitError';
  }
}

/**
 * Retry helper. Never retries 429 immediately — parses retryDelay from the
 * Gemini error body and blocks the model for that duration instead.
 */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> => {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            lastError = e;
            const errorMsg = e?.message || "";
            // Permanent errors — don't retry.
            if (
              errorMsg.includes('Requested entity was not found') ||
              errorMsg.includes('API key not valid') ||
              errorMsg.includes('is not found for API version')
            ) throw e;

            // 429: honor the retryDelay, do NOT retry immediately
            if (e?.status === 429 || errorMsg.includes('RESOURCE_EXHAUSTED')) throw e;

            // Other 4xx: don't retry
            if (e?.status >= 400 && e?.status < 500) throw e;

            if (i < maxRetries) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
};

/**
 * Like withRetry but cycles through IMAGE_MODEL_CHAIN on 429/rate-limit.
 * Finds the first model in the chain that isn't currently blocked.
 */
const withImageModelFallback = async <T>(
    buildRequest: (model: string) => Promise<T>
): Promise<T> => {
    let lastError: any;
    for (const model of IMAGE_MODEL_CHAIN) {
        const wait = blockedFor(model);
        if (wait > 0) {
            console.info(`[AI] ${model} blocked for ${wait}s — trying next`);
            continue;
        }
        if (!canRequest(model)) {
            console.info(`[AI] ${model} bucket empty — trying next`);
            continue;
        }
        try {
            return await buildRequest(model);
        } catch (e: any) {
            const msg = e?.message || '';
            if (e?.status === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
                on429(model, e);
                lastError = e;
                continue; // try next model
            }
            // Model retired/renamed (Google shuts image models down regularly —
            // see aiModels.ts): rotate to the next model instead of dying here.
            if (e?.status === 404 || msg.includes('not found')) {
                console.warn(`[AI] ${model} not found — trying next in chain`);
                lastError = e;
                continue;
            }
            throw e; // other errors — surface immediately
        }
    }
    // All models failed. Distinguish "plan has no image quota" (billing issue,
    // waiting won't help) from a genuine temporary rate limit.
    const lastMsg = lastError?.message || '';
    if (lastMsg.includes('quota') || lastMsg.includes('billing')) {
        const err = new Error('Image generation is out of quota on the current Gemini plan. Text AI still works — enable billing for the API key in Google AI Studio, or try again after the daily reset.');
        err.name = 'RateLimitError'; // callers already route this name to a toast
        throw err;
    }
    const soonest = Math.min(...IMAGE_MODEL_CHAIN.map(m => blockedFor(m)).filter(s => s > 0));
    throw new RateLimitError('image', isFinite(soonest) ? soonest : 60);
};

export const generateWelcomeGreeting = async (name?: string): Promise<string> => {
    const time = new Date().getHours();
    const period = time < 12 ? 'morning' : time < 17 ? 'afternoon' : 'evening';
    const namePart = name ? ` ${name}` : "";
    // Static fallbacks — save tokens, greetings don't need AI
    const fallbacks = [`Good ${period}${namePart} - Welcome to MaliMart`, "Welcome Back - Enjoy Shopping"];
    if (!canRequest(MODELS.TEXT)) return fallbacks[0];
    return withRetry(async () => {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `One punchy greeting (max 6 words) for a ${period}. Format: "Greeting${namePart} - Subtitle". English only.`,
        });
        return response.text || fallbacks[0];
    }).catch(() => fallbacks[0]);
};

export const generateProductDescription = async (productName: string, category: string, keywords: string): Promise<string> => {
  return withRetry(async () => {
    const ai = await getAI();
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
      contents: `Write a product description for "${productName}" (category: "${category}") the way a real seller who actually made or sources this item would write it — like they're telling a friend why it's worth buying, not writing an ad.
      Work in these details naturally if they fit: ${keywords}.
      Rules: talk like a person, not a brand. Be specific and concrete (what it's actually like to use/wear/own, not vague superlatives). No words like "premium", "elevate", "exquisite", "indulge", "unparalleled", "discerning", or "elegant" unless the product genuinely calls for that exact word. Short sentences are fine. It's okay to sound a little informal. Max 70 words. English only, plain text, no markdown.`,
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
    if (!canRequest(MODELS.TEXT)) throw new Error('Rate limit reached — please wait a moment and try again.');
    return withRetry(async () => {
        const ai = await getAI();
        const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: `Look at this product photo and write a listing the way the person who's actually selling it would.
                    Return ONLY a JSON object with:
                    - name: A clear, specific product title (max 5 words) — what it plainly is, not a slogan.
                    - category: The best fitting category from [Fashion & Beauty, Food & Pantry, Handicrafts & Products, Electronics, Home & Living, Agriculture & Livestock, Construction & Hardware, Kids & Toys, Vehicles & Parts, Books & Stationery].
                    - tags: Array of 5 relevant search keywords a buyer would actually type.
                    - description: 2 sentences, conversational, describing what's actually visible in the photo (material, color, style, condition). No marketing language — avoid words like "premium", "elevate", "exquisite", "sophisticated", "unparalleled".
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `Generate a professional, short SKU (Stock Keeping Unit) code for "${name}" in category "${category}". 
            Format: Uppercase, alphanumeric, 8-12 characters. Example: SHIRT-BLU-01. Return ONLY the string.`,
        });
        return response.text?.trim().replace(/[^A-Z0-9-]/g, '') || `SKU-${Date.now().toString().slice(-6)}`;
    }).catch(() => `SKU-${Date.now().toString().slice(-6)}`);
};

export const generateProductListing = async (name: string, imageBase64?: string): Promise<{ description: string, tags: string[], category?: string, subcategory?: string } | null> => {
    return withRetry(async () => {
        const ai = await getAI();
        let parts: any[] = [];
        
        if (imageBase64) {
            const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } });
        }
        
        parts.push({
            text: `Generate a listing for product "${name}", written the way the seller themself would describe it — plain, specific, no ad-speak. Return JSON with:
            1. description: max 60 words, conversational, concrete details over adjectives. Avoid words like "premium", "elevate", "exquisite", "unparalleled".
            2. tags: 5 relevant search keywords a buyer would actually type.
            3. category: Best fit from [Fashion & Beauty, Food & Pantry, Handicrafts & Products, Electronics, Home & Living, Agriculture & Livestock, Construction & Hardware, Kids & Toys, Vehicles & Parts, Books & Stationery].
            4. subcategory: A specific subcategory type.
            Use English.`
        });

        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `Translate the product description below into professional, engaging Swahili for a Tanzanian marketplace. Return ONLY the translated text — no English preamble, no explanation, no word-by-word breakdown, nothing else.\n\n${text}`,
        });
        return (response.text || text).trim();
    }).catch(() => text);
}

export const enhanceDescription = async (text: string): Promise<string> => {
    return withRetry(async () => {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `Tighten up this product description for a Tanzanian marketplace listing — fix awkward phrasing, add a concrete detail or two if something's missing, keep it easy to search for. Keep the seller's own voice and any specific details they already included; don't flatten it into generic ad copy. Avoid words like "premium", "elevate", "exquisite", "unparalleled", "indulge", "discerning" unless already used naturally. Keep it under 90 words. Plain prose only — no markdown, no asterisks, no bullet points, no headers.\n\n${text}`,
        });
        return (response.text || text).trim();
    }).catch(() => text);
}

export const moderateContent = async (name: string, description: string): Promise<{ isFlagged: boolean, reason: string }> => {
    return withRetry(async () => {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `Suggest a competitive premium price in Tanzanian Shillings (TZS) for this product: "${productName}" in category "${category}". Return ONLY the number. Example: 45000`,
        });
        const num = parseInt(response.text?.replace(/[^0-9]/g, '') || "0");
        return num > 0 ? num : 0;
    }).catch(() => 0);
}

export const generateTags = async (name: string, description: string): Promise<string[]> => {
    return withRetry(async () => {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `Generate 8 relevant SEO tags for a product named "${name}". Description: "${description}". Return ONLY a comma-separated list of tags. Example: "shoes, leather, mens fashion, summer, durable"`,
        });
        return (response.text || "").split(',').map(s => s.trim()).filter(s => s.length > 0);
    }).catch(() => []);
};

export const generateProductImage = async (prompt: string): Promise<string | null> => {
  return withImageModelFallback(async (model) => {
    const ai = await getAI();
    const response = await ai.models.generateContent({
      model,
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
    if (error?.name === 'RateLimitError') throw error; // let callers show a proper toast
    console.error("Gemini Image Gen Error:", error);
    return null;
  });
};

export const refineProductImage = async (imageInput: string, instruction: string): Promise<string | null> => {
    // Resolve image to base64 once, before trying models
    let mimeType = 'image/jpeg';
    let cleanBase64 = imageInput;
    if (imageInput.startsWith('http')) {
        // Cache-bust: the PWA service worker CacheFirst-caches this same URL
        // when it's loaded via a plain <img> tag, which fetches in 'no-cors'
        // mode and gets stored as an opaque (status 0) response. Reusing that
        // cached entry for this cors-mode fetch throws "opaque response used
        // for a request whose type is not no-cors". A distinct query string
        // is a cache miss, forcing a fresh cors-mode network fetch.
        const bustUrl = imageInput + (imageInput.includes('?') ? '&' : '?') + '_ai=1';
        const fetchRes = await fetch(bustUrl, { mode: 'cors', cache: 'no-store' });
        const blob = await fetchRes.blob();
        mimeType = blob.type || 'image/jpeg';
        const buffer = await blob.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        cleanBase64 = btoa(binary);
    } else if (imageInput.includes('base64,')) {
        const imgParts = imageInput.split('base64,');
        cleanBase64 = imgParts[1];
        const match = imgParts[0].match(/:(.*?);/);
        if (match) mimeType = match[1];
    }

    return withImageModelFallback(async (model) => {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model,
            contents: {
                parts: [
                    { inlineData: { mimeType, data: cleanBase64 } },
                    { text: `Edit this image to improve its e-commerce appeal. Specifically: ${instruction}. Keep it high resolution and photorealistic.` }
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
        if (e?.name === 'RateLimitError') throw e;
        console.error("Refine Error:", e);
        return null;
    });
};


export const generateRecipesFromCart = async (ingredients: string[]): Promise<any[]> => {
  return withRetry(async () => {
    const ai = await getAI();
    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
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
        const ai = await getAI();
        const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
    const ai = await getAI();
    const candidates = products.filter(p => p.stock > 0).slice(0, 30);
    if (candidates.length === 0) return null;

    const response = await ai.models.generateContent({
      model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: query,
            config: {
                systemInstruction: "You are MaliMart AI, a helpful shopping assistant. Communicate clearly in English.",
            }
        });
        return response.text || "I am here to help.";
    }).catch(() => "Sorry, I'm having trouble connecting to my brain right now. Please try again later.");
};

export const generateRecipeCardImage = async (title: string): Promise<string | null> => {
    return withImageModelFallback(async (model) => {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model,
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
    if (!canRequest(MODELS.TEXT)) return ["Yes, it is available.", "I can ship this today.", "Let me check the stock."];
    return withRetry(async () => {
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `Seller on MaliMart. 3 short polite reply options for: "${context.slice(0, 200)}". Under 10 words each. JSON array of strings.`,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
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
        const ai = await getAI();
        const response = await ai.models.generateContent({
            model: MODELS.TEXT,
            contents: `Rewrite the following draft message for a seller to a buyer. 
            Draft: "${draft}"
            Tone: ${tone}
            Keep it concise and natural for a chat interface.`,
        });
        return response.text || draft;
    }).catch(() => draft);
};
