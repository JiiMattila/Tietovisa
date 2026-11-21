import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';
import { getDemoQuestions } from '../netlify/functions/question-bank.mjs';
import { geminiBatch, geminiResponse } from './fixtures/gemini.mjs';
process.env.GEMINI_API_KEY='mock';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY='sb_secret_mock';
let generated=0,picked=0,created;
const saved=[];
const pool=getDemoQuestions(50);
globalThis.fetch=async (url,options) => {
  if(url.includes('generativelanguage.googleapis.com')) {
    const { count, categories } = geminiBatch(JSON.parse(options.body));
    generated+=count;
    return geminiResponse(pool.slice(generated-count,generated), categories);
  }
  const body=JSON.parse(options.body);
  if(url.endsWith('quiz_recent_questions')) return Response.json([]);
  if(url.endsWith('quiz_bank_save')) {
    for (const question of body.p_items) assert.equal(question.category, body.p_topic);
    saved.push(...body.p_items);
    return Response.json(body.p_items.length);
  }
  if(url.endsWith('quiz_bank_pick')) {picked++;return Response.json([]);}
  if(url.endsWith('quiz_create_room')) {created=body;return Response.json({code:body.p_code,playerId:'00000000-0000-4000-8000-000000000001'});}
  throw Error(url);
};
const input={name:'Testi',total:20,timer:15,topic:'Historia',difficulty:'helppo'};
let response=await handler(new Request('https://test.netlify.app/api/create',{method:'POST',body:JSON.stringify(input)}));
assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
assert.equal(generated,40);assert.equal(saved.length,40);assert.equal(picked,0);
assert.equal(new Set(saved.map(question => question.fingerprint)).size, 40);
const activeTexts = new Set(created.p_questions.map(question => question.text));
const reserves = saved.filter(question => !activeTexts.has(question.text));
assert.equal(reserves.length, 20);
assert.equal(new Set(reserves.map(question => question.category)).size, 12);
assert.equal(created.p_questions.length,20);assert.equal(created.p_question_source,'ai');
// Kiintiön täyttyessä käytetään pankkia ja viimeisenä turvaverkkona demokysymyksiä.
globalThis.fetch=async(url,options)=>{
 if(url.includes('generativelanguage.googleapis.com'))return Response.json({error:{message:'quota'}},{status:429});
 const body=JSON.parse(options.body);
 if(url.endsWith('quiz_recent_questions')) return Response.json([]);
 if(url.endsWith('quiz_bank_pick')) {picked++;return Response.json(pool.slice(0,20));}
 if(url.endsWith('quiz_create_room')) {created=body;return Response.json({code:body.p_code,playerId:'00000000-0000-4000-8000-000000000001'});}
 throw Error(url);
};
response=await handler(new Request('https://test.netlify.app/api/create',{method:'POST',body:JSON.stringify(input)}));
assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
assert.equal(created.p_question_source,'bank');assert.equal(created.p_questions.length,20);
assert.ok(picked>0);
console.log('OK: 20 pelikysymystä ja 20 eri aihealueiden varakysymystä tallennetaan. Kiintiötilanteessa käytetään kysymyspankkia.');
