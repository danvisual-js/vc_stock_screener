require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Anthropic Client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post('/api/ai-proxy', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Call Claude
    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    // Return the response text
    res.json({ result: msg.content[0].text });
  } catch (error) {
    console.error('Claude Proxy Error:', error);
    res.status(500).json({ error: 'Failed to fetch response from Claude' });
  }
});

app.listen(port, () => {
  console.log(`Claude Proxy running at http://localhost:${port}`);
});
