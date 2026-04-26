/* global __dirname */
const fs = require('fs');
const http = require('http');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const defaultPort = 8787;

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = process.env[key] || value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const taskProfileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'concepts', 'semantic_categories', 'nsfw', 'profanity', 'safety'],
  properties: {
    summary: { type: 'string' },
    concepts: { type: 'array', items: { type: 'string' }, maxItems: 16 },
    semantic_categories: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    nsfw: { type: 'boolean' },
    profanity: { type: 'boolean' },
    safety: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'reasons'],
      properties: {
        status: { type: 'string', enum: ['safe', 'review', 'blocked'] },
        reasons: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      },
    },
  },
};

const userProfileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'concepts', 'preferred_categories'],
  properties: {
    summary: { type: 'string' },
    concepts: { type: 'array', items: { type: 'string' }, maxItems: 16 },
    preferred_categories: { type: 'array', items: { type: 'string' }, maxItems: 8 },
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': process.env.SIDEHUSTLE_APP_ORIGIN || '*',
    'Content-Type': 'application/json',
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, corsHeaders());
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 128_000) {
        request.destroy();
        reject(new Error('payload-too-large'));
      }
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function buildPrompt(kind, input) {
  const shared = [
    'You create compact SideHustle marketplace matching metadata.',
    'Return low-case, reusable concepts like tech, smartphone, cleaning, moving, yard, events, delivery, organizing, tutoring, pet, auto, admin, beauty, fitness, cooking, childcare, hospitality.',
    'Do not rank gigs. Only summarize semantic matching signals.',
  ];

  if (kind === 'task_match_profile') {
    return [
      ...shared,
      'This safety check applies ONLY to creating or editing gigs, not counter bids or chat messages.',
      'Feel Free to use your thinking to decide if a gig is NSFW or profane, but do not over-index on specific words. Consider the overall intent and context of the gig.',
      'NSFW/adult-content rule: set nsfw=true and safety.status=blocked if the gig title, description, or categories ask for, offer, imply, joke about, or euphemistically describe sexual contact, sexual companionship, hookups, adult entertainment, erotic or sensual services, escorting, erotic massage, nude or intimate photo/video requests, pornography, fetish content, stripping, or any task whose actual purpose is sexual or explicit.',
      'Block direct or casual sexual solicitation even when the wording is short, vague, misspelled, or mixed with harmless filler. Examples that MUST be blocked include: "hello there sex wanted", "sex wanted", "need sex", "looking for sex", "hookup", "friends with benefits", "sensual massage", "adult fun" and "nudes".',
      'Do not treat a gig as safe just because it lacks graphic detail. If the likely user intent is sexual, adult, or NSFW, block it.',
      'Set profanity=true and safety.status=blocked when the gig title, description, or categories contain swear words, profanity, slurs, vulgar insults, or abusive language.',
      'Also mark blocked for illegal goods or services, weapons, stolen items, or clearly hazardous requests. Mark review for regulated or risky non-NSFW and non-profane services.',
      `Gig JSON: ${JSON.stringify(input)}`,
    ].join('\n');
  }

  return [
    ...shared,
    'Create a preference profile for the hustler from categories, bio, age, trust stats, and location context.',
    `User JSON: ${JSON.stringify(input)}`,
  ].join('\n');
}

function responseFormatFor(kind) {
  const schema = kind === 'task_match_profile' ? taskProfileSchema : userProfileSchema;

  return {
    type: 'json_schema',
    name: kind,
    strict: true,
    schema,
  };
}

function extractOutputText(openAiResponse) {
  if (typeof openAiResponse.output_text === 'string') {
    return openAiResponse.output_text;
  }

  const output = Array.isArray(openAiResponse.output) ? openAiResponse.output : [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    const textItem = content.find((part) => typeof part.text === 'string');

    if (textItem) {
      return textItem.text;
    }
  }

  return '';
}

async function createProfile(body) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { statusCode: 503, payload: { error: 'OPENAI_API_KEY is not configured on the AI match endpoint.' } };
  }

  const kind = body.kind === 'user_match_profile' ? 'user_match_profile' : 'task_match_profile';
  const model = process.env.OPENAI_MATCH_MODEL || body.model_hint || 'gpt-5.5';
  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: buildPrompt(kind, body.input ?? {}),
      text: {
        format: responseFormatFor(kind),
      },
    }),
  });

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text();
    return { statusCode: openAiResponse.status, payload: { error: errorText } };
  }

  const data = await openAiResponse.json();
  const outputText = extractOutputText(data);

  if (!outputText) {
    return { statusCode: 502, payload: { error: 'OpenAI response did not include output text.' } };
  }

  return { statusCode: 200, payload: JSON.parse(outputText) };
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method === 'GET' && (request.url === '/' || request.url === '/ai-match')) {
    writeJson(response, 200, {
      ok: true,
      endpoint: 'POST /ai-match',
      app_origin: process.env.SIDEHUSTLE_APP_ORIGIN || '*',
      model: process.env.OPENAI_MATCH_MODEL || 'gpt-5.5',
      openai_configured: Boolean(process.env.OPENAI_API_KEY),
    });
    return;
  }

  if (request.method !== 'POST' || request.url !== '/ai-match') {
    writeJson(response, 404, { error: 'POST /ai-match expected.' });
    return;
  }

  try {
    const body = await readJson(request);
    const result = await createProfile(body);
    writeJson(response, result.statusCode, result.payload);
  } catch (error) {
    writeJson(response, 500, { error: error instanceof Error ? error.message : 'AI match endpoint failed.' });
  }
});

server.listen(Number(process.env.PORT || defaultPort), () => {
  const port = Number(process.env.PORT || defaultPort);
  console.log(`SideHustle AI match endpoint listening on http://localhost:${port}/ai-match`);
});
