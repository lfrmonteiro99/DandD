import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const results: Record<string, unknown> = {
    api_key_present: !!apiKey,
    api_key_prefix: apiKey ? apiKey.slice(0, 8) + '...' : 'NONE',
  };

  if (!apiKey) {
    return NextResponse.json({ ...results, error: 'No API key' });
  }

  // Test 1: Simple text generation (no JSON mode)
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Say "hello world" in a fun way. One sentence only.');
    const text = result.response.text();
    results.test1_simple = { success: true, response: text };
  } catch (err: any) {
    results.test1_simple = { success: false, error: err.message };
  }

  // Test 2: JSON mode
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });
    const result = await model.generateContent(
      'You are a D&D dungeon master. A player says "I look around the tavern". Respond with JSON: {"narration": "your 2 sentence description"}'
    );
    const text = result.response.text();
    results.test2_json = { success: true, raw_response: text };
    try {
      const parsed = JSON.parse(text);
      results.test2_parsed = parsed;
    } catch {
      results.test2_parse_error = 'Failed to parse JSON';
    }
  } catch (err: any) {
    results.test2_json = { success: false, error: err.message };
  }

  // Test 3: With system instruction (like our DM setup)
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: 'You are a D&D dungeon master. Always respond in valid JSON.',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
      },
    });
    const result = await model.generateContent(
      'A player enters a tavern and says "I look around". Respond with: {"narration": "2-3 sentence vivid description", "mood": "atmospheric"}'
    );
    const text = result.response.text();
    results.test3_full = { success: true, raw_response: text };
    try {
      const parsed = JSON.parse(text);
      results.test3_parsed = parsed;
      results.test3_has_narration = !!parsed.narration;
    } catch {
      results.test3_parse_error = 'Failed to parse JSON';
    }
  } catch (err: any) {
    results.test3_full = { success: false, error: err.message };
  }

  return NextResponse.json(results);
}
