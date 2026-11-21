import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';
import { getDemoQuestions } from '../netlify/functions/question-bank.mjs';
process.env.GEMINI_API_KEY = 'test-not-real';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_mock';
const sample = getDemoQuestions(50);
let generated = 0;
let geminiCalls = 0;
let saved = null;
let created = null;
let picked = 0;
globalThis.fetch = async (url, opts) => {
  if (url.includes('generativelanguage.googleapis.com')) {
    geminiCalls++;
    assert.equal(opts.headers['x-goog-api-key'], 'test-not-real');
    const body = JSON.parse(opts.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    const count = Number(body.contents[0].parts[0].text.match(/Luo (\d+)/)[1]);
    const questions = sample.slice(generated, generated + count);
    generated += count;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({questions})}]}}]});
  }
  const body = JSON.parse(opts.body);
  if (url.endsWith('/quiz_recent_questions')) return Response.json([]);
  if (url.endsWith('/quiz_bank_save')) {
    saved = body;
    return Response.json(body.p_items.length);
  }
  if (url.endsWith('/quiz_bank_pick')) {
    picked++;
    return Response.json([]);
  }
  if (url.endsWith('/quiz_create_room')) {
    created = body;
    return Response.json({code:body.p_code, playerId:'00000000-0000-4000-8000-000000000001'});
  }
  throw new Error(`Unexpected request: ${url}`);
};
const response = await handler(new Request('https://test.netlify.app/api/create', {
  method:'POST',body:JSON.stringify({name:'Testi',total:5,timer:15,topic:'Historia',difficulty:'helppo'})
}));
assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
assert.equal(geminiCalls, 2);
assert.equal(generated, 15);
assert.equal(saved.p_items.length, 15);
assert.equal(new Set(saved.p_items.map(q=>q.fingerprint)).size, 15);
assert.equal(created.p_questions.length, 5);
assert.equal(created.p_question_source, 'ai');
assert.equal(picked, 0);
console.log('OK: Gemini request and JSON parsing, 5 game questions + 10 reserve questions, bank save and room creation.');
