/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Enable JSON bodies with higher limits for Excel batch loads
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Set up data directory and persistence path
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products_v3.json"); // Save to a fresh version to reset default list cleanly
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically under /api/uploads
app.use("/api/uploads", express.static(UPLOADS_DIR));

// Default high-quality catalog data with premium Unsplash imagery matching requested core fields
const DEFAULT_PRODUCTS = [
  {
    id: "prod-1",
    productCode: "PROD-EL-001",
    name: "AeroSound X1 Premium Wireless Active Noise Cancelling Headphones",
    description: "Equipped with state-of-the-art hybrid noise cancelling processors, premium memory foam ear cushions, and high-fidelity custom drivers delivering rich studio sound with up to 45 hours of battery life.",
    uom: "Pcs",
    category: "Electronics",
    subCategory: "Audio Tech",
    status: "Active",
    price: 249.99,
    stock: 85,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "prod-2",
    productCode: "PROD-HL-014",
    name: "Minimalist Brass Arch Table Lamp",
    description: "A gorgeous architectural light fixture made of solid polished brass, featuring a frosted white glass sphere diffuser that casts a warm, relaxing accent glow over desktop workspaces.",
    uom: "Box",
    category: "Home & Lifestyle",
    subCategory: "Lighting",
    status: "Active",
    price: 89.00,
    stock: 30,
    imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "prod-3",
    productCode: "PROD-OW-083",
    name: "Vanguard Waterproof Adventure Backpack",
    description: "Crafted from ultralight 840D military-grade ballistic nylon. Built to survive harsh weather elements, featuring a padded laptop chamber, magnetic utility clips, and ergonomic shoulder strap stabilizers.",
    uom: "Set",
    category: "Outdoor & Travel",
    subCategory: "Adventure Gear",
    status: "Active",
    price: 155.00,
    stock: 140,
    imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "prod-4",
    productCode: "PROD-HL-051",
    name: "H13 composite True HEPA Active Air Purifier Filter",
    description: "Replacement dual-stage carbon air filter designed to capture 99.97% of high-density airborne particles, including fine dust, pet dander, pollens, and cooking odors down to 0.3 microns.",
    uom: "Pack",
    category: "Home & Lifestyle",
    subCategory: "Filtration Core",
    status: "Inactive",
    price: 39.00,
    stock: 0,
    imageUrl: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=800&auto=format&fit=crop&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "prod-5",
    productCode: "PROD-OT-112",
    name: "CNC Knurled Aluminum Mechanical Architect Drafting Pencil",
    description: "Perfect weight-balanced mechanical lead pencil for draftsmen and architects. Styled with structural micro-grip texture, an integrated eraser sleeve, and a premium steel pocket clip.",
    uom: "Doz",
    category: "Office Tools",
    subCategory: "Stationery",
    status: "Discontinued",
    price: 18.50,
    stock: 12,
    imageUrl: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&auto=format&fit=crop&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "prod-6",
    productCode: "PROD-EL-204",
    name: "OmniKeys Compact 75% Custom Mechanical Keyboard",
    description: "Pre-lubed linear silent tactile switches mounted in a solid block CNC milled workspace frame. Standard PBT keycaps with crisp legends and modern minimalist white underglow backlighting.",
    uom: "Pcs",
    category: "Electronics",
    subCategory: "Input Devices",
    status: "Active",
    price: 195.00,
    stock: 22,
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Helper to read products
function readProductsFromFile() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const raw = fs.readFileSync(PRODUCTS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Error reading products file, fallback to default seed data:", error);
  }
  // Store default if file empty or nonexistent
  writeProductsToFile(DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS;
}

// Helper to write products
function writeProductsToFile(products: any[]) {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing products database file:", error);
  }
}

// Lazy load Gemini AI Client safely
let aiClient: GoogleGenAI | null = null;
function getGeminiAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY variable is not present. AI copywriting assists will be restricted.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-catalog',
        }
      }
    });
  }
  return aiClient;
}

// --- API Endpoints ---

// GET: Retrieve all products
app.get("/api/products", (req, res) => {
  const products = readProductsFromFile();
  res.json(products);
});

// POST: Upload custom product images via Base64 stream
app.post("/api/products/upload-image", (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    // Capture standard data URIs (e.g. data:image/png;base64,iVBOR...)
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid base64 image data payload" });
    }

    const type = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Extract type extension safely
    let ext = "png";
    if (type.includes("jpeg") || type.includes("jpg")) {
      ext = "jpg";
    } else if (type.includes("gif")) {
      ext = "gif";
    } else if (type.includes("webp")) {
      ext = "webp";
    } else if (type.includes("svg")) {
      ext = "svg";
    }

    // Sanitize user files names to prevent injections
    const sanitizedBase = (filename || "product")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()
      .substring(0, 30);
    const uniqueFilename = `${sanitizedBase}_${Date.now()}_${Math.floor(Math.random() * 10000)}.${ext}`;
    const targetPath = path.join(UPLOADS_DIR, uniqueFilename);

    fs.writeFileSync(targetPath, buffer);

    res.json({
      imageUrl: `/api/uploads/${uniqueFilename}`
    });
  } catch (err: any) {
    console.error("Express photo upload parsing error:", err);
    res.status(500).json({ error: "Failed to persist image binary content", details: err.message });
  }
});

// GET: Calculate stats in simple format helper
app.get("/api/products/stats", (req, res) => {
  const products = readProductsFromFile();
  
  const totalProducts = products.length;
  let activeCount = 0;
  let inactiveCount = 0;
  let discontinuedCount = 0;

  const categoriesMap: { [cat: string]: { count: number; activeCount: number } } = {};

  products.forEach((p: any) => {
    const status = String(p.status || "Active");
    if (status === "Active") activeCount++;
    else if (status === "Inactive") inactiveCount++;
    else if (status === "Discontinued") discontinuedCount++;

    const cat = p.category || "Uncategorized";
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = { count: 0, activeCount: 0 };
    }
    categoriesMap[cat].count++;
    if (status === "Active") {
      categoriesMap[cat].activeCount++;
    }
  });

  const categoryStats = Object.keys(categoriesMap).map((cat) => ({
    category: cat,
    count: categoriesMap[cat].count,
    activeCount: categoriesMap[cat].activeCount
  }));

  res.json({
    totalProducts,
    activeCount,
    inactiveCount,
    discontinuedCount,
    categoryStats,
  });
});

// POST: Add new product
app.post("/api/products", (req, res) => {
  const products = readProductsFromFile();
  const input = req.body;

  if (!input.name || !input.productCode || !input.uom || !input.category) {
    return res.status(400).json({ error: "Missing required catalog fields. Name, Product Code, UoM, and Category are mandatory." });
  }

  // Provide high-quality category default image if custom one isn't specified
  let defaultImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80"; // standard default watch
  if (input.category === "Electronics") {
    defaultImage = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80";
  } else if (input.category === "Home & Lifestyle") {
    defaultImage = "https://images.unsplash.com/photo-1507512140264-ac60c121b4ae?w=800&auto=format&fit=crop&q=80";
  } else if (input.category === "Outdoor & Travel") {
    defaultImage = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80";
  } else if (input.category === "Office Tools") {
    defaultImage = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=80";
  }

  const newProduct = {
    id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    productCode: String(input.productCode).toUpperCase().trim(),
    name: String(input.name).trim(),
    description: String(input.description || "").trim(),
    uom: String(input.uom).trim(),
    category: String(input.category).trim(),
    subCategory: String(input.subCategory || "General").trim(),
    status: ["Active", "Inactive", "Discontinued"].includes(input.status) ? input.status : "Active",
    price: input.price !== undefined ? Math.max(0, parseFloat(input.price)) : undefined,
    stock: input.stock !== undefined ? Math.max(0, parseInt(input.stock, 10)) : undefined,
    imageUrl: String(input.imageUrl || defaultImage).trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  products.push(newProduct);
  writeProductsToFile(products);

  res.status(201).json(newProduct);
});

// POST: Batch Import multiple parsed products (from Excel / CSV parser)
app.post("/api/products/import", (req, res) => {
  const products = readProductsFromFile();
  const incoming = req.body;

  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: "Expected an array of imported products." });
  }

  let importedCount = 0;
  const newImportedItems: any[] = [];

  incoming.forEach((item: any) => {
    let codeStr = item.productCode || item["Product Code"] || item["code"] || item["Code"];
    let nameStr = item.name || item["Product Name"] || item["Name"] || item["Product Name/Description"] || item["Description"];
    let descStr = item.description || item["Description"] || item["Product Name/Description"] || "";
    let uomStr = item.uom || item["UoM"] || item["unit"] || item["Unit"] || "Pcs";
    let catStr = item.category || item["Category"] || "General";
    let subCatStr = item.subCategory || item["Sub Category"] || item["SubCategory"] || "";
    let imgStr = item.imageUrl || item["Image"] || item["imageUrl"] || item["Photo"] || "";
    
    // Status normalization
    let rawStatus = item.status || item["Status"] || "Active";
    let norStatus = "Active";
    if (String(rawStatus).toLowerCase().includes("inactive") || String(rawStatus).toLowerCase() === "i") {
      norStatus = "Inactive";
    } else if (String(rawStatus).toLowerCase().includes("discon") || String(rawStatus).toLowerCase() === "d") {
      norStatus = "Discontinued";
    }

    let itemPrice = item.price || item["Price"] || item["Rate"];
    let itemStock = item.stock || item["Stock"] || item["Qty"] || item["Quantity"];

    if (codeStr && nameStr) {
      let defaultImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80";
      if (String(catStr) === "Electronics") {
        defaultImage = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80";
      } else if (String(catStr) === "Home & Lifestyle") {
        defaultImage = "https://images.unsplash.com/photo-1507512140264-ac60c121b4ae?w=800&auto=format&fit=crop&q=80";
      } else if (String(catStr) === "Outdoor & Travel") {
        defaultImage = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80";
      }

      newImportedItems.push({
        id: `prod-import-${Date.now()}-${Math.floor(Math.random() * 100000)}-${importedCount++}`,
        productCode: String(codeStr).toUpperCase().trim(),
        name: String(nameStr).trim(),
        description: String(descStr || nameStr).trim(),
        uom: String(uomStr).trim(),
        category: String(catStr).trim(),
        subCategory: String(subCatStr).trim(),
        status: norStatus as any,
        price: itemPrice !== undefined ? Math.max(0, parseFloat(itemPrice)) : undefined,
        stock: itemStock !== undefined ? Math.max(0, parseInt(itemStock, 10)) : undefined,
        imageUrl: String(imgStr || defaultImage).trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  });

  if (newImportedItems.length === 0) {
    return res.status(400).json({ error: "No records with at least a valid 'Product Code' and 'Product Name' were detected inside matching headers." });
  }

  // Merge/Replace matching products based on Product Code
  const codeIndexMap: { [code: string]: number } = {};
  products.forEach((p: any, idx: number) => {
    codeIndexMap[p.productCode] = idx;
  });

  newImportedItems.forEach((newItem) => {
    const existingIdx = codeIndexMap[newItem.productCode];
    if (existingIdx !== undefined) {
      products[existingIdx] = {
        ...products[existingIdx],
        ...newItem,
        id: products[existingIdx].id,
        createdAt: products[existingIdx].createdAt,
        updatedAt: new Date().toISOString()
      };
    } else {
      products.push(newItem);
    }
  });

  writeProductsToFile(products);
  res.json({ success: true, count: newImportedItems.length });
});

// PUT: Update complete product specifications
app.put("/api/products/:id", (req, res) => {
  const products = readProductsFromFile();
  const targetId = req.params.id;
  const index = products.findIndex((p: any) => p.id === targetId);

  if (index === -1) {
    return res.status(404).json({ error: `Catalog entry ${targetId} not found.` });
  }

  const existingProduct = products[index];
  const input = req.body;

  const updatedProduct = {
    ...existingProduct,
    productCode: input.productCode !== undefined ? String(input.productCode).toUpperCase().trim() : existingProduct.productCode,
    name: input.name !== undefined ? String(input.name).trim() : existingProduct.name,
    description: input.description !== undefined ? String(input.description).trim() : existingProduct.description,
    uom: input.uom !== undefined ? String(input.uom).trim() : existingProduct.uom,
    category: input.category !== undefined ? String(input.category).trim() : existingProduct.category,
    subCategory: input.subCategory !== undefined ? String(input.subCategory).trim() : existingProduct.subCategory,
    status: ["Active", "Inactive", "Discontinued"].includes(input.status) ? input.status : existingProduct.status,
    price: input.price !== undefined ? Math.max(0, parseFloat(input.price)) : existingProduct.price,
    stock: input.stock !== undefined ? Math.max(0, parseInt(input.stock, 10)) : existingProduct.stock,
    imageUrl: input.imageUrl !== undefined ? String(input.imageUrl).trim() : existingProduct.imageUrl,
    updatedAt: new Date().toISOString()
  };

  products[index] = updatedProduct;
  writeProductsToFile(products);

  res.json(updatedProduct);
});

// DELETE: Remove product from catalog
app.delete("/api/products/:id", (req, res) => {
  const products = readProductsFromFile();
  const targetId = req.params.id;
  const filteredProducts = products.filter((p: any) => p.id !== targetId);

  if (filteredProducts.length === products.length) {
    return res.status(404).json({ error: `Catalog entry ${targetId} not found.` });
  }

  writeProductsToFile(filteredProducts);
  res.json({ success: true, message: `Product ${targetId} deleted from database registry.` });
});

// POST: AI Copywriter assistant with Gemini optimized for the Catalog specific fields
app.post("/api/ai/copywrite", async (req, res) => {
  try {
    const { name, category, subCategory, keywords, tone } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Product name is required for generation." });
    }

    const ai = getGeminiAI();
    if (!ai) {
      return res.status(503).json({
        error: "AI service could not load. Ensure your GEMINI_API_KEY is configured in Secrets settings."
      });
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
            description: {
              type: Type.STRING,
              description: "Expert clean product catalog description explaining utility, craftsmanship and specs."
            },
            uom: {
              type: Type.STRING,
              description: "Logical single value representing Unit of Measure, e.g. Pcs, Box, Set, Pack."
            },
            category: {
              type: Type.STRING,
              description: "Polished standard Category title."
            },
            subCategory: {
              type: Type.STRING,
              description: "Polished standard Subcategory title."
            }
          },
          required: ["description", "uom", "category", "subCategory"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    res.json(parsedData);
  } catch (err: any) {
    console.error("Gemini AI copy generation failure:", err);
    res.status(500).json({ error: "Gemini copywriter was unable to complete this query.", details: err.message });
  }
});

// --- Server Delivery Pipelines ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite middleware for direct fast assets HMR and SPA serving in developer sandbox
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static compiled app files inside production containers
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Product Catalog Engine successfully serving at http://0.0.0.0:${PORT} on ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

startServer();
