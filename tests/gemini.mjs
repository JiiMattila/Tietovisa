import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';
import { getDemoQuestions } from '../netlify/functions/question-bank.mjs';
import { geminiBatch, geminiResponse } from './fixtures/gemini.mjs';

process.env.GEMINI_API_KEY = 'test-not-real';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_mock';

const pool = getDemoQuestions(30);
const playerId = '00000000-0000-4000-8000-000000000001';
const credentials = { code: 'GEMYNY', playerId, secret: '1'.repeat(64) };
const settings = { name: 'Testi', total: 5, timer: 15, difficulty: 'helppo' };
const startAt = '2026-11-21T13:00:00.123456+00:00';
const chosenTopics = ['Elokuvat', 'Suomalainen musiikki'];
const calls = [];
let phase, created, completion;

globalThis.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  const name = url.split('/').at(-1);
  if (url.includes('generativelanguage.googleapis.com')) {
    const { count, categories } = geminiBatch(body);
    calls.push({ name: 'Gemini', count, categories });
    assert.equal(opts.headers['x-goog-api-key'], 'test-not-real');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    const questionSchema = body.generationConfig.responseSchema.properties.questions;
    assert.equal(questionSchema.maxItems, undefined);
    assert.deepEqual(questionSchema.items.properties.category, { type: 'string' });
    if ((phase === 'reserve-failure' && count === 20) || (phase === 'primary-failure' && count === 5)) {
      return Response.json({ error: { message: 'quota' } }, { status: 429 });
    }
    return geminiResponse(count === 5 ? pool.slice(0, 5) : pool.slice(5, 25),
      categories.map(category => category.toLocaleLowerCase('fi')));
  }
  calls.push({ name, body });
  if (name === 'quiz_recent_questions') return Response.json([]);
  if (name === 'quiz_create_room') {
    created = body;
    return Response.json({ code: body.p_code, playerId });
  }
  if (name === 'quiz_set_ready') {
    if (!body.p_generation || phase === 'other-player') return Response.json({ ok: true });
    if (!body.p_generation.startedAt) {
      assert.deepEqual(body.p_generation, {});
      return Response.json({ generation: {
        startedAt: startAt, total: 5, topic: 'Pelaajien valitsemat', difficulty: 'helppo', topics: chosenTopics
      } });
    }
    completion = body.p_generation;
    return Response.json({ ok: true });
  }
  if (name === 'quiz_bank_save') {
    assert.equal(body.p_difficulty, 'helppo');
    assert.ok(body.p_items.every(question => question.category === body.p_topic));
    return Response.json(body.p_items.length);
  }
  assert.fail('Unexpected service call: ' + url);
};

async function post(action, data) {
  const response = await handler(new Request('https://test.netlify.app/api/' + action, {
    method: 'POST', body: JSON.stringify(data)
  }));
  const value = await response.json();
  assert.equal(response.status, 200, JSON.stringify(value));
  return value;
}
function reset(nextPhase) {
  phase = nextPhase;
  calls.length = 0;
  completion = undefined;
}
function savedQuestions() {
  return calls.filter(call => call.name === 'quiz_bank_save').flatMap(call => call.body.p_items);
}
function assertDistinctQuestions(expected) {
  const saved = savedQuestions();
  assert.equal(saved.length, expected);
  assert.equal(new Set(saved.map(q => q.fingerprint)).size, expected);
}

await post('create', { ...settings, topicMode: 'all' });
assert.equal(created.p_question_source, 'ai');
assert.equal(created.p_topic, 'Vapaa');
assert.equal(new Set(created.p_questions.map(question => question.category)).size, 5);
assertDistinctQuestions(25);

reset('other-player');
await post('create', { ...settings, topicMode: 'players' });
assert.equal(created.p_questions.length, 0);
assert.deepEqual(await post('ready', { ...credentials, ready: true }), { ok: true });
assert.deepEqual(calls.map(call => call.name), ['quiz_create_room', 'quiz_set_ready']);

reset('last-player');
assert.deepEqual(await post('ready', { ...credentials, ready: true }), { ok: true });
assert.equal(completion.startedAt, startAt);
assert.deepEqual(completion.topics, chosenTopics);
assert.deepEqual(new Set(completion.questions.map(q => q.category)), new Set(chosenTopics));
assert.equal(completion.questions.length, 5);
assert.ok(completion.questions.every(question => question.fingerprint.length === 64));
assertDistinctQuestions(25);

reset('reserve-failure');
assert.deepEqual(await post('ready', { ...credentials, ready: true }), { ok: true });
assert.equal(completion.questions.length, 5);
assertDistinctQuestions(5);

reset('primary-failure');
assert.deepEqual(await post('ready', { ...credentials, ready: true }), { ok: true });
assert.deepEqual(completion.questions, []);
assertDistinctQuestions(20);
assert.equal(new Set(savedQuestions().map(q => q.category)).size, 12);

console.log('OK: molemmat aihevalintatavat, valmiushaku ja erillisten Gemini-erien virheenkäsittely.');
