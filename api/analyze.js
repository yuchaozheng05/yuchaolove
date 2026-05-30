export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
  try {
    const { imageBase64, imageMediaType, selectedStyle, context } = req.body;
    const prompt = "You are a Chinese emotional advisor helping someone pursue a crush. Analyze the chat screenshot.\n1. Give attitude_label (8 Chinese chars max).\n2. Give attitude_desc (100 Chinese chars, key signals + strategy).\n3. Generate 3 reply suggestions in style: " + selectedStyle + ". Natural, under 50 chars, push conversation forward.\n" + (context ? "Background: " + context + "\n" : "") + "Return ONLY JSON, no markdown:\n{\"attitude_label\":\"\",\"attitude_desc\":\"\",\"replies\":[{\"tag\":\"" + selectedStyle + "\",\"text\":\"\"},{\"tag\":\"" + selectedStyle + "\",\"text\":\"\"},{\"tag\":\"" + selectedStyle + "\",\"text\":\"\"}]}";
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: imageMediaType || 'image/jpeg', data: imageBase64 } }, { text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 1000 } })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    res.status(200).json(JSON.parse(clean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
