import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { getGeminiAI } from "../services/gemini.js";

const router = Router();

router.post("/api/ai/copywrite", async (req, res) => {
  try {
    const { name, category, subCategory, keywords, tone } = req.body;
    if (!name) return res.status(400).json({ error: "Product name is required for generation." });

    const ai = getGeminiAI();
    if (!ai) {
      return res.status(503).json({ error: "AI service could not load. Ensure your GEMINI_API_KEY is configured." });
    }

    const keywordsStr = keywords && Array.isArray(keywords) ? keywords.filter(Boolean).join(", ") : "None";
    const selectedTone = tone || "professional";

    const prompt = `Develop logical catalog attributes for a newly catalogued product with these raw properties:
    - Rough Product Title: "${name}"
    - Rough Category Hint: "${category || 'General'}"
    - Rough Subcategory Hint: "${subCategory || 'General'}"
    - Attributes / Keywords: "${keywordsStr}"
    - Copy tone: "${selectedTone}"

    You must generate and autofill:
    1. A concise, professional e-commerce product description (70-130 words). Clean, direct, and benefit-focused.
    2. A suggested logical standard Unit of Measure (UoM) (must select one option like: 'Pcs', 'Box', 'Set', 'Kg', 'Pack', 'Doz').
    3. A polished, standardized Category name.
    4. A polished, standardized Subcategory name.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a senior catalog architect and structured content generator. Respond strictly with formatted structured fields, avoiding all conversational fluff or markdown wrapper texts.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Expert clean product catalog description explaining utility, craftsmanship and specs." },
            uom: { type: Type.STRING, description: "Logical single value representing Unit of Measure, e.g. Pcs, Box, Set, Pack." },
            category: { type: Type.STRING, description: "Polished standard Category title." },
            subCategory: { type: Type.STRING, description: "Polished standard Subcategory title." },
          },
          required: ["description", "uom", "category", "subCategory"],
        },
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    res.status(500).json({ error: "Gemini copywriter was unable to complete this query.", details: err.message });
  }
});

export default router;
