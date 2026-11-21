import { createHash, randomBytes } from 'node:crypto';
import { getDemoQuestions } from './question-bank.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from(randomBytes(6), byte => codeAlphabet[byte % codeAlphabet.length]).join('');
const cleanName = value => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);
const hash = secret => createHash('sha256').update(secret).digest('hex');
const BANK_EXTRA = 10;
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc(name, params) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Palvelinta ei ole vielä asetettu: lisää SUPABASE_URL ja SUPABASE_SECRET_KEY Netlifyyn.');
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': key,
      // Uusi sb_secret_-avain ei ole JWT; Authorization-header kuuluu vain vanhalle service_role-avaimelle.
      ...(!key.startsWith('sb_secret_') ? { 'Authorization': `Bearer ${key}` } : {}) },
    body: JSON.stringify(params)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Käyttäjälle turvallinen virhe; yksityiskohtaiset virheet näkyvät palvelimen lokissa.
    if (result.code === '23505') throw new Error('Pelikoodi tai nimimerkki on jo käytössä.');
    if (result.message && /^(P0001|23514)$/.test(result.code || '')) throw new Error(result.message);
    console.error('Supabase RPC:', name, response.status, result);
    throw new Error('Tietokantayhteys epäonnistui. Tarkista SQL-asennus ja Netlifyn ympäristömuuttujat.');
  }
  return result;
}

function checkQuestions(items, count) {
  if (!Array.isArray(items) || items.length !== count) throw new Error('Kysymysten luonti ei palauttanut oikeaa määrää. Yritä uudelleen.');
  return items.map((q, i) => {
    if (!q || typeof q.text !== 'string' || q.text.trim().length < 8 || q.text.length > 300 ||
      !Array.isArray(q.options) || q.options.length !== 5 ||
      q.options.some(opt => typeof opt !== 'string' || !opt.trim() || opt.length > 130) ||
      new Set(q.options.map(opt => opt.toLocaleLowerCase('fi'))).size !== 5 ||
      !Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 4 ||
      typeof q.explanation !== 'string' || !q.explanation.trim() || q.explanation.length > 500) {
      throw new Error(`Tekoäly tuotti virheellisen kysymyksen (${i + 1}). Yritä uudelleen.`);
    }
    // Kaikki vaihtoehdot ja oikean vastauksen paikka sekoitetaan palvelimella.
    const opts = q.options.map((text, originalIndex) => ({ text: text.trim(), originalIndex }));
    for (let k = 4; k > 0; k--) {
      const n = randomBytes(1)[0] % (k + 1);
      [opts[k], opts[n]] = [opts[n], opts[k]];
    }
    return {
      text: q.text.trim(),
      options: opts.map(o => o.text),
      answerIndex: opts.findIndex(o => o.originalIndex === q.answerIndex),
      explanation: q.explanation.trim()
    };
  });
}

async function generateQuestions(total, topic, difficulty) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY puuttuu');
  const schema = {
    type: 'object',
    properties: {
      questions: {
        type: 'array', minItems: total, maxItems: total,
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            options: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string' } },
            answerIndex: { type: 'integer', minimum: 0, maximum: 4 },
            explanation: { type: 'string' }
          },
          required: ['text', 'options', 'answerIndex', 'explanation']
        }
      }
    },
    required: ['questions']
  };
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45000);
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  // Mallin nimi on ylläpidon asetus, ei koskaan selaimesta saatu syöte.
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Virheellinen GEMINI_MODEL-asetus.');
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Olet tarkka tietokilpailukysymysten laatija. Kirjoita suomeksi. Luo vain tosiasiallisesti tarkistettavia kysymyksiä, joilla on TASAN yksi yksiselitteinen oikea vastaus viidestä vaihtoehdosta. Vaihtoehdot ovat uskottavia ja keskenään erilaisia. Älä käytä ajankohtaisia muuttuvia faktoja, epäselviä ennätyksiä tai subjektiivisia mielipiteitä. Anna jokaiselle lyhyt perustelu. Älä toista kysymyksiä. Jos aihe on sopimaton, valitse neutraali yleissivistävä näkökulma.' }] },
        contents: [{ role: 'user', parts: [{ text: `Luo ${total} erilaista tietokilpailukysymystä. Aihe: ${topic}. Vaikeustaso: ${difficulty}. Vastausvaihtoehtoja 5/kysymys, yksi oikea. answerIndex on 0–4.` }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 12000, temperature: 0.7 }
      })
    });
  } finally { clearTimeout(timeout); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Gemini API:', response.status, result.error?.message || result.error);
    // Ilmaiskiintiön ylittyessä voidaan jatkaa peliä demokysymyksillä.
    if (response.status === 429 || response.status === 503) {
      const error = new Error('Geminin ilmaiskiintiö tai palvelu ei ole käytettävissä');
      error.quota = true;
      throw error;
    }
    throw new Error('Gemini-kysymysten luonti epäonnistui. Tarkista GEMINI_API_KEY ja mallin saatavuus.');
  }
  const output = result.candidates?.[0]?.content?.parts?.filter(part => typeof part.text === 'string').map(part => part.text).join('');
  if (!output) throw new Error('Gemini ei palauttanut kysymyksiä. Yritä uudelleen.');
  let parsed;
  try { parsed = JSON.parse(output); } catch { throw new Error('Kysymysten muoto ei ollut kelvollinen. Yritä uudelleen.'); }
  return { questions: checkQuestions(parsed.questions, total), source: 'ai', topic };
}

// Pankkiin tallennetaan kanoniset kysymykset. Oikeat vastaukset eivät koskaan siirry selaimeen ennen paljastusta.
const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const fingerprint = question => hash(normalize(question.text));
const shuffle = array => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomBytes(4).readUInt32BE(0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
function randomizedQuestion(q) {
  const options = shuffle(q.options.map((value, index) => ({ value, index })));
  return { text: q.text, options: options.map(o => o.value),
    answerIndex: options.findIndex(o => o.index === q.answerIndex), explanation: q.explanation };
}
async function saveToBank(questions, topic, difficulty) {
  if (!questions.length) return;
  await rpc('quiz_bank_save', { p_topic: topic, p_difficulty: difficulty,
    p_items: questions.map(q => ({ ...q, fingerprint: fingerprint(q) })) });
}
async function getFromBank(topic, difficulty, limit, excluded = []) {
  if (limit <= 0) return [];
  const rows = await rpc('quiz_bank_pick', { p_topic: topic, p_difficulty: difficulty,
    p_limit: limit, p_exclude: excluded });
  return Array.isArray(rows) ? rows.map(q => ({
    text: q.text, options: q.options, answerIndex: q.answerIndex,
    explanation: q.explanation
  })) : [];
}
async function prepareQuestions(total, topic, difficulty) {
  let fresh = [];
  let quota = false;
  if (process.env.GEMINI_API_KEY) {
    try {
      // Generointi kahdessa erässä vähentää yksittäisen vastauksen katkeamisriskiä.
      const primary = await generateQuestions(total, topic, difficulty);
      fresh = primary.questions;
      try {
        const reserve = await generateQuestions(BANK_EXTRA, topic, difficulty);
        fresh.push(...reserve.questions);
      } catch (error) {
        console.warn('Varakysymysten generointi epäonnistui:', error.message);
      }
    } catch (error) {
      quota = Boolean(error.quota);
      console.warn('Gemini ei ole käytettävissä, käytetään kysymyspankkia:', error.message);
    }
  }
  // Suodata samanmuotoiset kysymykset myös kahden generointierän välillä.
  const seen = new Set();
  fresh = fresh.filter(q => {
    const id = fingerprint(q);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (fresh.length) {
    try { await saveToBank(fresh, topic, difficulty); }
    catch (error) { console.warn('Kysymyspankin tallennus epäonnistui:', error.message); }
  }
  // Ensisijaisesti tuoreita, ja tarvittaessa saman aiheen ja vaikeustason vanhoja.
  const selected = fresh.slice(0, total);
  let bankCount = 0;
  if (selected.length < total) {
    try {
      const old = await getFromBank(topic, difficulty, total - selected.length,
        [...seen]);
      for (const q of old) {
        const id = fingerprint(q);
        if (!seen.has(id)) { selected.push(q); seen.add(id); bankCount++; }
      }
    } catch (error) { console.warn('Kysymyspankin haku epäonnistui:', error.message); }
  }
  if (selected.length < total) {
    // Viimeinen turvaverkko: 50 paikallista yleissivistyskysymystä.
    for (const q of shuffle(getDemoQuestions(50))) {
      if (selected.length >= total) break;
      const id = fingerprint(q);
      if (!seen.has(id)) { selected.push(q); seen.add(id); }
    }
  }
  if (selected.length !== total) throw new Error('Kysymyksiä ei saatu riittävästi.');
  const source = fresh.length >= total ? 'ai' : fresh.length ? 'mixed' : bankCount ? 'bank' : 'demo';
  return { questions: checkQuestions(selected.map(randomizedQuestion), total), source, topic: source === 'demo' ? 'Yleistieto (demo)' : topic, quota };
}

const validateAuth = data => {
  const code = String(data.code ?? '').trim().toUpperCase();
  const id = String(data.playerId ?? '');
  const secret = String(data.secret ?? '');
  if (!CODE_RE.test(code) || !UUID_RE.test(id) || !/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('Virheellinen pelikoodi tai pelaajatunniste.');
  }
  return { p_code: code, p_player_id: id, p_secret_hash: hash(secret) };
};

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Käytä POST-pyyntöä.' }, 405);
  const action = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  if (!['create', 'join', 'state', 'start', 'answer'].includes(action)) return json({ error: 'Tuntematon toiminto.' }, 404);
  try {
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Virheellinen pyyntö.');
    if (action === 'create') {
      const name = cleanName(data.name);
      const total = Number(data.total);
      const timer = Number(data.timer);
      const topic = String(data.topic ?? '').trim().slice(0, 80) || 'Yleistieto';
      const difficulty = String(data.difficulty ?? 'keskitaso');
      if (!name || name.length > 20 || !Number.isInteger(total) || total < 5 || total > 30 ||
          !Number.isInteger(timer) || timer < 10 || timer > 60 ||
          !['helppo','keskitaso','vaikea'].includes(difficulty)) {
        throw new Error('Tarkista nimi, kysymysten määrä, aika ja vaikeustaso.');
      }
      const secret = randomBytes(32).toString('hex');
      const { questions, source, topic: actualTopic } = await prepareQuestions(total, topic, difficulty);
      let created;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          created = await rpc('quiz_create_room', {
            p_code: makeCode(), p_name: name, p_secret_hash: hash(secret),
            p_total: total, p_timer: timer, p_topic: actualTopic, p_difficulty: difficulty,
            p_question_source: source, p_questions: questions
          });
          break;
        } catch (err) {
          if (!err.message.includes('Pelikoodi tai nimimerkki on jo käytössä')) throw err;
        }
      }
      if (!created) throw new Error('Pelihuoneen luonti epäonnistui. Kokeile uudelleen.');
      return json({ ...created, secret });
    }
    if (action === 'join') {
      const code = String(data.code ?? '').trim().toUpperCase();
      const name = cleanName(data.name);
      if (!CODE_RE.test(code) || !name) throw new Error('Anna kelvollinen pelikoodi ja nimimerkki.');
      const secret = randomBytes(32).toString('hex');
      const joined = await rpc('quiz_join_room', { p_code: code, p_name: name, p_secret_hash: hash(secret) });
      return json({ ...joined, secret });
    }
    const auth = validateAuth(data);
    if (action === 'state') return json(await rpc('quiz_get_state', auth));
    if (action === 'start') return json(await rpc('quiz_start_room', auth));
    if (action === 'answer') {
      const choice = Number(data.choice);
      if (!Number.isInteger(choice) || choice < 0 || choice > 4) throw new Error('Valitse yksi viidestä vastauksesta.');
      return json(await rpc('quiz_submit_answer', { ...auth, p_choice: choice }));
    }
  } catch (err) {
    console.error('Quiz API:', err?.message);
    return json({ error: err?.name === 'AbortError' ? 'Kysymysten luonti aikakatkaistiin. Yritä uudelleen.' : err?.message || 'Odottamaton virhe.' }, 400);
  }
};
