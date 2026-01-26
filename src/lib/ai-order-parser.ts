import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || '';
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1200, 2500];

export interface ParsedOrderData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  deliveryState: string;
  deliveryFee: number;
  orderTotal: number;
  websiteOrderReference: string;
  items: Array<{
    productName: string;
    variantInfo: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

const PARSING_PROMPT = `
You are an AI assistant for a Nigerian eyewear business called Fyll. Your job is to extract order information from WhatsApp messages.

Extract the following information from the message:
1. Customer's full name
2. Phone number (Nigerian format, e.g., +234 803 555 0101)
3. Email address (if present)
4. Delivery address (full street address)
5. Delivery state (Nigerian state, e.g., Lagos, Abuja, Rivers)
6. Products ordered (name, variant/color, quantity, unit price if present)
7. Delivery fee (numeric, if present)
8. Order total (numeric, if present)
9. Website/order reference (e.g., Order #, Ref)
10. Any special notes (lens coating, prescriptions, custom requests, etc.)

Common product types: Aviator, Wayfarer, frames, sunglasses, glasses
Common variants: Gold, Silver, Black, Matte Black, Rose Gold

Return the data in this exact JSON format:
{
  "customerName": "Full Name",
  "customerPhone": "+234XXXXXXXXXX",
  "customerEmail": "email@example.com",
  "deliveryAddress": "Full street address",
  "deliveryState": "State name",
  "deliveryFee": 0,
  "orderTotal": 0,
  "websiteOrderReference": "45876",
  "items": [
    {
      "productName": "Product name",
      "variantInfo": "Color or variant",
      "quantity": 2,
      "unitPrice": 17000
    }
  ],
  "notes": "Any special requests or notes",
  "confidence": "high"
}

If information is missing, use empty string "" for text fields and 0 for numeric fields. Set confidence to "high" if you're very sure, "medium" if somewhat sure, "low" if guessing.

Message to parse:
`;

export async function parseOrderFromText(messageText: string): Promise<ParsedOrderData | null> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const text = await generateWithModelFallback(genAI, PARSING_PROMPT + messageText);

    // Extract JSON from response (AI might wrap it in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from AI response');
    }

    const parsedData: ParsedOrderData = JSON.parse(jsonMatch[0]);

    // Validate that we got at least a name or phone
    if (!parsedData.customerName && !parsedData.customerPhone) {
      return null;
    }

    return parsedData;
  } catch (error) {
    console.error('AI parsing error:', error);
    throw normalizeGeminiError(error);
  }
}

async function generateWithRetry(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  prompt: string
): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      if (attempt >= MAX_RETRIES || !isRetryableGeminiError(error)) {
        throw error;
      }
      await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
    }
  }

  throw new Error('AI parsing failed unexpectedly.');
}

async function generateWithModelFallback(
  genAI: GoogleGenerativeAI,
  prompt: string
): Promise<string> {
  const models = GEMINI_MODEL ? [GEMINI_MODEL] : [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-002',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
  ];

  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      return await generateWithRetry(model, prompt);
    } catch (error) {
      lastError = error;
      const message = String((error as Error | undefined)?.message || '');
      if (!message.includes('404') && !message.includes('not found')) {
        throw error;
      }
    }
  }

  throw lastError || new Error('No compatible Gemini model found.');
}

function isRetryableGeminiError(error: unknown): boolean {
  const message = String((error as Error | undefined)?.message || '');
  return message.includes('429') || message.toLowerCase().includes('quota') || message.includes('503');
}

function normalizeGeminiError(error: unknown): Error {
  const message = String((error as Error | undefined)?.message || '');
  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return new Error(
      'Gemini API quota exceeded. Confirm the key is from the correct project, the Gemini API is enabled, and billing/quota is active. Then retry.'
    );
  }
  return error instanceof Error ? error : new Error('AI parsing failed.');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to format the parsed data for display
export function formatParsedOrder(data: ParsedOrderData): string {
  let formatted = `**Customer Information:**\n`;
  formatted += `Name: ${data.customerName || 'Not found'}\n`;
  formatted += `Phone: ${data.customerPhone || 'Not found'}\n`;
  formatted += `Email: ${data.customerEmail || 'Not found'}\n`;
  formatted += `State: ${data.deliveryState || 'Not found'}\n`;
  formatted += `Address: ${data.deliveryAddress || 'Not found'}\n\n`;

  formatted += `**Products:**\n`;
  if (data.items.length > 0) {
    data.items.forEach((item, idx) => {
      formatted += `${idx + 1}. ${item.quantity}x ${item.productName}`;
      if (item.variantInfo) {
        formatted += ` (${item.variantInfo})`;
      }
      if (item.unitPrice) {
        formatted += ` - ₦${item.unitPrice.toLocaleString()}`;
      }
      formatted += '\n';
    });
  } else {
    formatted += 'No products found\n';
  }

  if (data.deliveryFee) {
    formatted += `\n**Delivery Fee:** ₦${data.deliveryFee.toLocaleString()}\n`;
  }
  if (data.orderTotal) {
    formatted += `**Order Total:** ₦${data.orderTotal.toLocaleString()}\n`;
  }
  if (data.websiteOrderReference) {
    formatted += `**Order Ref:** ${data.websiteOrderReference}\n`;
  }

  if (data.notes) {
    formatted += `\n**Notes:** ${data.notes}\n`;
  }

  formatted += `\n**Confidence:** ${data.confidence.toUpperCase()}`;

  return formatted;
}
