import assert from 'node:assert/strict';
import handler from '../netlify/functions/api.mjs';
import { getDemoQuestions } from '../netlify/functions/question-bank.mjs';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_fixture';
delete process.env.GEMINI_API_KEY;

const q = getDemoQuestions();
assert.equal(q.length, 120);
assert.equal(new Set(q.map(x=>x.text)).size, q.length);
for (const item of q) {
  assert.equal(item.options.length,5);
  assert.equal(new Set(item.options).size,5);
  assert.ok(Number.isInteger(item.answerIndex) && item.answerIndex>=0 && item.answerIndex<5);
  assert.ok(item.options[item.answerIndex]);
}

let sent = [];
globalThis.fetch = async (url,options) => {
  const body = JSON.parse(options.body);
  sent.push({url,body,headers:options.headers});
  assert.ok(!options.headers.Authorization, 'New secret keys must not be sent as JWT');
  if (url.endsWith('/quiz_get_stats')) return Response.json({gamesStarted: 3, bankQuestions: 0, ignored: true});
  if (url.endsWith('/quiz_recent_questions')) return Response.json([]);
  if (url.endsWith('/quiz_bank_pick')) return Response.json([]);
  if (url.endsWith('/quiz_bank_pick_varied')) return Response.json(q.slice(0,body.p_limit));
  if (url.endsWith('/quiz_create_room')) {
    const playersChoose = body.p_topic_mode === 'players';
    assert.equal(body.p_questions.length, playersChoose ? 0 : 20);
    assert.equal(body.p_question_source, playersChoose || body.p_topic === 'Vapaa' ? 'bank' : 'demo');
    if (playersChoose) assert.equal(body.p_topic, 'Pelaajien valitsemat');
    assert.match(body.p_code,/^[A-HJ-NP-Z2-9]{6}$/);
    assert.match(body.p_secret_hash,/^[a-f0-9]{64}$/);
    return Response.json({code:body.p_code,playerId:'00000000-0000-4000-8000-000000000001'});
  }
  if (url.endsWith('/quiz_join_room')) {
    return Response.json({code:body.p_code,playerId:'00000000-0000-4000-8000-000000000002'});
  }
  if (url.endsWith('/quiz_get_state')) return Response.json({status:'lobby',code:body.p_code,players:[]});
  if (url.endsWith('/quiz_start_room')) return Response.json({ok:true});
  if (url.endsWith('/quiz_set_ready')) return Response.json({ok:true});
  if (url.endsWith('/quiz_choose_topic')) return Response.json({ok:true});
  if (url.endsWith('/quiz_rematch')) return Response.json({ok:true});
  if (url.endsWith('/quiz_submit_answer')) return Response.json({accepted:true});
  throw new Error('Unexpected URL '+url);
};
const post = async (action,data) => {
  const response = await handler(new Request(`https://play.netlify.app/api/${action}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  }));
  return {status:response.status,data:await response.json()};
};
const stats = await handler(new Request('https://play.netlify.app/api/stats'));
assert.equal(stats.status, 200);
assert.equal(stats.headers.get('cache-control'), 'no-store');
assert.deepEqual(await stats.json(), {gamesStarted: 3, bankQuestions: 0});
assert.ok(sent.at(-1).url.endsWith('/quiz_get_stats'));
assert.deepEqual(sent.at(-1).body, {});
assert.equal((await post('stats',{})).status, 405);
const created = await post('create',{name:'Pelaaja yksi',topic:'Historia',total:20,timer:15,difficulty:'keskitaso'});
assert.equal(created.status,200);
assert.equal(created.data.secret.length,64);
assert.match(created.data.code,/^[A-HJ-NP-Z2-9]{6}$/);
const joined = await post('join',{name:'Pelaaja kaksi',code:created.data.code});
assert.equal(joined.status,200);
const creds = {code:created.data.code,secret:created.data.secret,playerId:created.data.playerId};
const settings = {name:'Testi',topic:'Historia',total:20,timer:15,difficulty:'keskitaso'};
assert.equal((await post('create',{...settings,topicMode:'all'})).status,200);
assert.equal(sent.at(-1).body.p_topic,'Vapaa');
const callsBeforeLobby = sent.length;
assert.equal((await post('create',{...settings,topicMode:'players'})).status,200);
assert.equal(sent.length,callsBeforeLobby+1,'Question selection waits for the lobby to finish');
assert.equal((await post('create',{...settings,topicMode:'invalid'})).status,400);
assert.equal((await post('topic',{...creds,topic:'Historia'})).data.ok,true);
assert.ok(sent.at(-1).url.endsWith('/quiz_choose_topic'));
assert.equal(sent.at(-1).body.p_topic,'Historia');
assert.equal((await post('topic',{...creds,topic:null})).status,400);
for (const accept of [true,false]) {
  assert.equal((await post('rematch',{...creds,accept})).data.ok,true);
  assert.ok(sent.at(-1).url.endsWith('/quiz_rematch'));
  assert.equal(sent.at(-1).body.p_accept,accept);
}
assert.equal((await post('rematch',{...creds,accept:'true'})).status,400);
assert.equal((await post('state',creds)).data.status,'lobby');
assert.equal((await post('start',creds)).data.ok,true);
for (const ready of [true, false]) {
  assert.equal((await post('ready',{...creds,ready})).data.ok,true);
  assert.ok(sent.at(-1).url.endsWith('/quiz_set_ready'));
  assert.equal(sent.at(-1).body.p_ready,ready);
}
assert.equal((await post('ready',{...creds,ready:'false'})).status,400);
assert.equal((await post('answer',{...creds,choice:3})).data.accepted,true);
assert.ok(!Object.hasOwn(sent.at(-1).body,'p_round_index'));
assert.equal((await post('answer',{...creds,choice:0,roundIndex:0})).data.accepted,true);
assert.equal(sent.at(-1).body.p_round_index,0);
assert.equal(sent.at(-1).body.p_choice,0);
assert.equal((await post('answer',{...creds,choice:3,roundIndex:-1})).status,400);
assert.equal((await post('answer',{...creds,choice:3,roundIndex:null})).status,400);
assert.equal((await post('answer',{...creds,choice:5})).status,400);
assert.equal((await post('state',{...creds,secret:'x'})).status,400);
console.log('OK: 120 demo questions, creation, join, state, readiness, answer, invalid input.');
console.log(`API mock calls: ${sent.length}`);
