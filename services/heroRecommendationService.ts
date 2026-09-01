import { Type } from "@google/genai";
import { getAI } from './aiClient';
import { MODELS } from './aiModels';
import { supabase } from './supabaseClient';

export const generateHeroRecommendation = async () => {
    const ai = await getAI(); // lazy — loads the SDK only when this actually runs
    // 1. Fetch top selling products
    const { data: products } = await supabase
        .from('products')
        .select('id, name, description, price, category')
        .limit(10);

    if (!products) return null;

    // 2. Use Gemini to generate a recommendation
    const prompt = `Analyze these products and suggest the best one for a homepage hero section. 
    Consider high price, popularity, and visual appeal. 
    Suggest a catchy title, a short description, a price display string, and a structured offer (e.g., type: 'percentage' or 'fixed', value: number, text: string).
    
    Products: ${JSON.stringify(products)}
    
    Return the result as JSON.`;

    const response = await ai.models.generateContent({
        model: MODELS.TEXT,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    product_id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    price_display: { type: Type.STRING },
                    offer: { 
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['percentage', 'fixed'] },
                            value: { type: Type.NUMBER },
                            text: { type: Type.STRING }
                        },
                        required: ["type", "value", "text"]
                    },
                },
                required: ["product_id", "title", "description", "price_display", "offer"],
            },
        },
    });

    const recommendation = JSON.parse(response.text || '{}');
    
    // 3. Save to database
    const { data, error } = await supabase
        .from('hero_recommendations')
        .insert({
            ...recommendation,
            offer_text: JSON.stringify(recommendation.offer), // Store structured offer as JSON string
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};
