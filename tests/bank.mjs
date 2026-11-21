import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';
import { getDemoQuestions } from '../netlify/functions/question-bank.mjs';
process.env.GEMINI_API_KEY='mock';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY='sb_secret_mock';
let generated=0,saved=0,picked=0,created;
const pool=getDemoQuestions(50);
globalThis.fetch=async (url,options) => {
  if(url.includes('generativelanguage.googleapis.com')) {
    const count=Number(JSON.parse(options.body).contents[0].parts[0].text.match(/Luo (\d+)/)[1]);
    generated+=count;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({questions:pool.slice(generated-count,generated)})}]}}]});
  }
  const body=JSON.parse(options.body);
  if(url.endsWith('quiz_recent_questions')) return Response.json([]);
  if(url.endsWith('quiz_bank_save')) {saved=body.p_items.length;return Response.json(saved);}
  if(url.endsWith('quiz_bank_pick')) {picked++;return Response.json([]);}
  if(url.endsWith('quiz_create_room')) {created=body;return Response.json({code:body.p_code,playerId:'00000000-0000-4000-8000-000000000001'});}
  throw Error(url);
};
const input={name:'Testi',total:20,timer:15,topic:'Historia',difficulty:'helppo'};
let response=await handler(new Request('https://test.netlify.app/api/create',{method:'POST',body:JSON.stringify(input)}));
assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
assert.equal(generated,30);assert.equal(saved,30);assert.equal(picked,0);
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
console.log('OK: 20 pelikysymystä + 10 varakysymystä tallennetaan; kiintiötilanteessa kysymyspankki toimii.');
