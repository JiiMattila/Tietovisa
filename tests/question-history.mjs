import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import handler from '../netlify/functions/api.mjs';
import { getDemoQuestions } from '../netlify/functions/question-bank.mjs';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_fixture';
delete process.env.GEMINI_API_KEY;

const demos = getDemoQuestions();
const normalize = text => text.normalize('NFKC').toLocaleLowerCase('fi')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const fingerprint = question => createHash('sha256').update(normalize(question.text)).digest('hex');
const recentEntry = question => ({text:question.text,answer:question.options[question.answerIndex]});
const topics = ['Maantieto','Historia','Tiede','Luonto','Kirjallisuus ja taide',
  'Musiikki','Suomalainen musiikki','Elokuvat','Urheilu','Teknologia','Matematiikka','Ruoka ja juoma'];

const rooms = [];
async function create(topic, total = 30) {
  const response = await handler(new Request('https://test.netlify.app/api/create', {
    method:'POST', body:JSON.stringify({name:'Testi',total,timer:15,topic,difficulty:'keskitaso'})
  }));
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  return rooms.at(-1);
}
function saveRoom(params) {
  rooms.push(params);
  return Response.json({code:params.p_code,playerId:'00000000-0000-4000-8000-000000000001'});
}
globalThis.fetch = async (url, options) => {
  const params = JSON.parse(options.body);
  if (url.endsWith('/quiz_recent_questions')) {
    return Response.json([...rooms].reverse().flatMap(room => room.p_questions.map(recentEntry)));
  }
  if (url.endsWith('/quiz_bank_pick')) return Response.json([]);
  if (url.endsWith('/quiz_create_room')) return saveRoom(params);
  assert.fail('Unexpected RPC ' + url);
};

for (let i = 0; i < 4; i++) await create('Testiaihe ilman pankkia');
const firstCycle = rooms.flatMap(room => room.p_questions.map(fingerprint));
assert.equal(new Set(firstCycle).size, 120, 'All demo questions must be used before the first repeats');
const revisited = await create('Testiaihe ilman pankkia');
assert.deepEqual(new Set(revisited.p_questions.map(fingerprint)), new Set(rooms[0].p_questions.map(fingerprint)));

process.env.GEMINI_API_KEY = 'unused-with-varied';
globalThis.fetch = async (url, options) => {
  const params = JSON.parse(options.body);
  if (url.endsWith('/quiz_recent_questions')) return Response.json(rooms[0].p_questions.map(recentEntry));
  if (url.endsWith('/quiz_bank_pick_varied')) {
    assert.equal(params.p_difficulty, 'keskitaso');
    assert.equal(params.p_limit, topics.length);
    assert.equal(params.p_recent.length, 30);
    assert.deepEqual(new Set(params.p_topics), new Set(topics.map(normalize)));
    return Response.json(topics.map((topic, index) => ({
      ...demos[index], category:topic
    })));
  }
  if (url.endsWith('/quiz_create_room')) return saveRoom(params);
  assert.fail('Vapaa must fetch the diversified bank, not Gemini or an exact topic lookup');
};
const varied = await create('Vapaa aihealue', topics.length);
assert.equal(varied.p_topic, 'Vapaa');
assert.equal(varied.p_question_source, 'bank');
assert.deepEqual(new Set(varied.p_questions.map(q => q.category)), new Set(topics));

const original = {
  text:'Mikä on kaupungin keskustan vanhimman puiston nimi?',
  options:['Puistola','Metsälä','Turvamaa','Ylitarha','Laaksola'], answerIndex:0,
  explanation:'Kaupungin vanhin puisto on Puistola.'
};
const rephrased = {...original,text:'Mikä on kaupungin keskustan kaikkein vanhimman puiston nimi?'};
const unique = demos.slice(0, 13);
let calls = 0;
globalThis.fetch = async (url, options) => {
  const params = JSON.parse(options.body);
  if (url.endsWith('/quiz_recent_questions')) return Response.json([recentEntry(original)]);
  if (url.includes('generativelanguage.googleapis.com')) {
    const prompt = params.contents[0].parts[0].text;
    assert.ok(prompt.includes(original.text));
    if (calls++ === 0) return Response.json(gemini([original,rephrased,...unique.slice(0,3)]));
    assert.ok(prompt.includes(unique[0].text), 'The second request excludes questions from the first');
    return Response.json(gemini(unique.slice(3)));
  }
  if (url.endsWith('/quiz_bank_save')) {
    assert.equal(params.p_items.length, 13);
    assert.ok(!params.p_items.some(q => q.text === original.text || q.text === rephrased.text));
    return Response.json(13);
  }
  if (url.endsWith('/quiz_create_room')) return saveRoom(params);
  assert.fail('Unexpected RPC ' + url);
};
function gemini(questions) {
  return {candidates:[{content:{parts:[{text:JSON.stringify({questions})}]}}]};
}
const generated = await create('Testipuistot', 5);
assert.equal(generated.p_question_source, 'ai');
assert.ok(generated.p_questions.every(q => q.text !== original.text && q.text !== rephrased.text));
console.log('OK: demo history rotation, diversified selection, Gemini exclusion and paraphrase filtering.');
