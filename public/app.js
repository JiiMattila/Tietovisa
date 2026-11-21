const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const letters = ['A','B','C','D','E'];
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let identity = null;
let state = null;
let loading = false;
let busy = false;
let polling = null;
let clockOffset = 0;
let lastRoundKey = '';
let toastTimer;

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4700);
}
function saveIdentity(value) {
  identity = value;
  localStorage.setItem('visa:' + value.code, JSON.stringify(value));
  const url = new URL(location.href);
  url.searchParams.set('room', value.code);
  history.replaceState({}, '', url);
}
function reset() {
  identity = null;
  state = null;
  lastRoundKey = '';
  history.replaceState({}, '', location.pathname);
  renderHome();
}
async function api(action, data) {
  let response;
  try {
    response = await fetch('/api/' + action, {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
  } catch { throw new Error('Verkkoyhteys katkesi. Tarkista yhteys ja yritä uudelleen.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Palvelinvirhe. Yritä uudelleen.');
  return result;
}
function credentials() {
  return { code: identity.code, playerId: identity.playerId, secret: identity.secret };
}
function formField(label, name, placeholder, value='', extra='') {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" placeholder="${placeholder}" maxlength="80" value="${escapeHtml(value)}" ${extra} required></div>`;
}
function renderHome() {
  const prefill = new URLSearchParams(location.search).get('room') || '';
  document.title = 'Nörttien Arvauskeskus — Moninpeli';
  app.innerHTML = `
    <section class="hero"><div class="hero-inner">
      <div class="eyebrow">✦ HAASTA KAVERISI</div>
      <h1 class="display">Tietoa. Nopeutta.<br><em>Yksi voittaja.</em></h1>
      <p class="lead">Kerää kaverit kasaan, luo pelikoodi ja ottakaa mittaa toisistanne. Sama kysymys kaikille, viisi vaihtoehtoa ja yksi oikea vastaus. Pelaa suoraan selaimessa.</p>
      <div class="metrics"><span class="metric"><span class="metric-icon">♟</span> 1–10 pelaajaa</span><span class="metric"><span class="metric-icon">◷</span> Reaaliaikaiset kierrokset</span><span class="metric"><span class="metric-icon">✦</span> 10 aihealuetta</span></div>
    </div></section>
    <section class="panels">
      <form id="create-form" class="panel">
        <span class="panel-icon">✦</span>
        <h2>Luo uusi peli</h2>
        <p class="panel-desc">Valitse asetukset ja jaa pelikoodi muille pelaajille.</p>
        ${formField('Oma nimimerkki','create-name','Esim. Tietäjä99','','autocomplete="nickname"')}
        <div class="field"><label for="topic-mode">Aihealueet</label><select id="topic-mode" name="topic-mode"><option value="all">Kaikki aihealueet</option><option value="players">Pelaajien valitsemat</option></select><small>Pelaajien valitsemassa pelissä jokainen varaa yhden aiheen odotushuoneessa.</small></div>
        <div class="twocol">
          <div class="field"><label for="total">Kysymyksiä</label><select id="total" name="total"><option value="5">5 kysymystä</option><option value="10" selected>10 kysymystä</option><option value="15">15 kysymystä</option><option value="20">20 kysymystä</option><option value="30">30 kysymystä</option></select></div>
          <div class="field"><label for="timer">Aika / kysymys</label><select id="timer" name="timer"><option value="10">10 sekuntia</option><option value="15" selected>15 sekuntia</option><option value="20">20 sekuntia</option><option value="30">30 sekuntia</option><option value="45">45 sekuntia</option><option value="60">60 sekuntia</option></select></div>
        </div>
        <div class="field"><label for="difficulty">Vaikeustaso</label><select id="difficulty" name="difficulty"><option value="helppo">Helppo</option><option value="keskitaso" selected>Keskitaso</option><option value="vaikea">Vaikea</option></select></div>
        <button class="btn btn-primary btn-full" type="submit" ${busy?'disabled':''}>${busy?'Luodaan peliä...':'Luo peli →'}</button>
      </form>
      <form id="join-form" class="panel">
        <span class="panel-icon blue">⌗</span>
        <h2>Liity peliin</h2>
        <p class="panel-desc">Kaverisi loi pelin? Syötä hänen lähettämänsä kuusimerkkinen koodi.</p>
        ${formField('Pelikoodi','join-code','Esim. K7P9X2',prefill,'maxlength="6" autocapitalize="characters"')}
        ${formField('Oma nimimerkki','join-name','Millä nimellä pelaat?','','autocomplete="nickname"')}
        <button type="submit" class="btn btn-blue btn-full" ${busy?'disabled':''}>Liity peliin →</button>
        <div class="divider"></div>
        <p class="subnote">Et tarvitse tunnusta tai sovellusta. Pelaamiseen riittää puhelin, tabletti tai tietokone.</p>
      </form>
    </section>`;
}
function roomTitle(title, sub, pill) {
  return `<div class="room-heading"><div><span class="eyebrow">NÖRTTIEN ARVAUSKESKUS / ${escapeHtml(state?.code || '')}</span><h1>${title}</h1><div class="room-subtitle">${sub}</div></div>${pill?`<span class="chip chip-green">${pill}</span>`:''}</div>`;
}
function renderPlayerAnswer(choice, question) {
  if (choice === undefined) return '';
  if (choice === null) return '<div class="player-answer muted">Ei vastannut</div>';
  const correct = choice === question.answerIndex;
  const result = correct ? '✓ Oikein' : '× Väärin';
  return `<div class="player-answer ${correct ? 'correct' : 'wrong'}">${result} · ${letters[choice]} — ${escapeHtml(question.options[choice])}</div>`;
}
function renderPlayers(kind='lobby') {
  const players = state.players || [];
  const sorted = kind === 'lobby' ? players : [...players].sort((a,b) => b.score-a.score);
  return `<div class="panel scoreboard"><div class="player-header"><h2>${kind === 'lobby' ? 'Pelaajat' : 'Pistetaulukko'}</h2><span class="count-pill">${players.length} / 10</span></div>
    ${kind==='lobby'?'<p class="scoreboard-head">Pelaajat odotushuoneessa</p>':'<p class="scoreboard-head">Sijoitukset livenä</p>'}
    <div class="player-list">${sorted.map((p, idx) => `<div class="player">
      ${kind==='lobby'?'':`<div class="rank-num">${idx+1}.</div>`}
      <div class="avatar ${idx%2?'alt':''}">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>
      <div class="player-grow"><div class="player-name">${escapeHtml(p.name)}${p.id===state.meId?'<span class="player-me">(sinä)</span>':''}</div>${p.isHost?'<span class="player-flag">PELİN LUOJA</span>':''}${kind==='lobby' && p.chosenTopic?`<div class="status-mark">${escapeHtml(p.chosenTopic)}</div>`:''}${state.status==='reveal'?renderPlayerAnswer(p.choice,state.question):''}</div>
      ${kind==='lobby'?'':`<span class="score">${p.score.toLocaleString('fi-FI')} p</span>`}
      ${kind==='lobby'?`<span class="status-mark ${p.ready?'done':''}">${p.ready?'✓ Valmis':'◷ Odottaa'}</span>`:''}
      ${kind==='question'?`<span class="status-mark ${p.answered?'done':''}">${p.answered?'✓':'◷'}</span>`:''}
    </div>`).join('')}</div>
    ${kind==='lobby'&&players.length===1?'<p class="subnote">Odotat muita pelaajia. Voit myös kokeilla peliä yksin.</p>':''}
  </div>`;
}
function renderTopicPicker(chosenTopic) {
  const reserved = new Set(state.players.filter(p => p.id!==state.meId).map(p => p.chosenTopic));
  const options = (state.topics || []).map(topic => {
    const taken = reserved.has(topic);
    return `<option value="${escapeHtml(topic)}" ${taken?'disabled':''} ${topic===chosenTopic?'selected':''}>${escapeHtml(topic)}${taken?' (varattu)':''}</option>`;
  }).join('');
  const hint = state.players.length>state.total
    ? '<small>Kysymyksiä on vähemmän kuin pelaajia, joten peli arpoo mukaan mahtuvat aiheet.</small>'
    : '';
  return `<div class="field"><label for="player-topic">Oma aihealue</label>
    <select id="player-topic" ${busy?'disabled':''}><option value="">${chosenTopic?'Vapauta valinta':'Valitse aihealue'}</option>${options}</select>
    <small>Valitse aihealue ennen kuin merkitset itsesi valmiiksi. Aiheen vaihtaminen peruu valmiuden.</small>${hint}
    </div>`;
}
function renderLobby() {
  document.title = `Odota pelaajia • ${state.code} — Nörttien Arvauskeskus`;
  const me = state.players.find(p => p.id===state.meId);
  const ready = me?.ready === true;
  const chooseTopics = state.topicMode==='players';
  const topic = state.topic==='Vapaa' ? 'Kaikki aihealueet' : state.topic;
  app.innerHTML = `${roomTitle('Odotushuone','Jaa koodi kavereille. Peli alkaa, kun kaikki huoneessa ovat valmiina.','● HUONE AUKI')}
    <section class="layout"><div class="panel">
      <div class="room-label">LIITTYMISKOODI</div>
      <div class="big-code-block"><div class="room-code">${escapeHtml(state.code)}</div><span class="muted">Kerro tämä koodi muille pelaajille</span></div>
      <div class="button-row"><button class="btn btn-secondary btn-small" data-action="copy-code">⧉ Kopioi koodi</button><button class="btn btn-secondary btn-small" data-action="copy-link">↗ Kopioi kutsulinkki</button></div>
      <div class="room-instructions"><strong>${state.total} kysymystä</strong> · ${state.timer} s / kysymys · ${escapeHtml(state.difficulty)}<br>Aihe: <strong>${escapeHtml(topic)}</strong><br><br>Kaikki vastaavat samaan kysymykseen omilta laitteiltaan. Nopeus vaikuttaa pisteisiin.</div>
      ${state.source==='demo'?'<div class="demo-alert">⚠ Demotila: käytössä ovat valmiit yleistietokysymykset. Oman aihealueen AI-kysymykset aktivoituvat, kun Gemini API -avain lisätään Netlifyyn.</div>':''}
      ${chooseTopics?renderTopicPicker(me?.chosenTopic):''}
      <button class="btn ${ready?'btn-secondary':'btn-primary'} btn-full" data-action="ready" data-ready="${!ready}" ${busy||(chooseTopics&&!me?.chosenTopic)?'disabled':''}>${ready?'Peru valmius':'Valmiina'}</button>
      <button class="btn btn-secondary btn-full" style="margin-top:10px" data-action="leave">Takaisin etusivulle</button>
    </div>${renderPlayers('lobby')}</section>`;
}
function renderQuestion() {
  const q = state.question;
  if (!q) return;
  const index = state.roundIndex;
  const selected = state.myAnswer;
  const answered = selected !== null && selected !== undefined;
  const reveal = state.status==='reveal';
  document.title = `Kysymys ${index+1}/${state.total} — Nörttien Arvauskeskus`;
  app.innerHTML = `<div class="game-top"><span class="progress-label">KYSYMYS ${index+1} / ${state.total}</span><span class="chip ${reveal?'':'chip-green'}">${reveal?'✓ Oikea vastaus':'● KYSYMYS KÄYNNISSÄ'}</span></div>
    <div class="progress-strip"><div class="progress-fill" style="width:${((index+1)/state.total)*100}%"></div></div>
    <section class="layout"><div>
      <div class="question-area"><div class="question-category"><span>${escapeHtml(q.category || state.topic)}</span><span>${escapeHtml(state.difficulty)}</span></div><h1 class="question-text">${escapeHtml(q.text)}</h1></div>
      <div class="timer-row"><span class="muted" style="font-size:.83rem">${reveal?'Seuraava kysymys':'Aikaa jäljellä'}</span><div class="timer-track"><div id="timer-bar" class="timer-bar"></div></div><span id="timer-value" class="timer-value">--</span></div>
      <div class="answer-grid">${q.options.map((option,i) => {
        const classes = ['answer'];
        if (reveal && q.answerIndex===i) classes.push('correct');
        else if (reveal && answered && selected===i) classes.push('wrong');
        else if (answered && selected===i) classes.push('selected');
        const icon = reveal && q.answerIndex===i ? '✓' : reveal && answered && selected===i ? '×' : answered && selected===i ? '✓' : '';
        return `<button data-action="answer" data-choice="${i}" class="${classes.join(' ')}" aria-pressed="${selected===i}" ${reveal||busy?'disabled':''}><span class="answer-letter">${letters[i]}</span><span class="answer-text">${escapeHtml(option)}</span><span class="answer-icon">${icon}</span></button>`;
      }).join('')}</div>
      ${reveal?`<div class="reveal-explanation"><strong>${answered&&selected===q.answerIndex?'Oikein vastattu!':'Oikea vastaus: '+letters[q.answerIndex]+' — '+escapeHtml(q.options[q.answerIndex])}</strong>${escapeHtml(q.explanation || '')}</div>`:'<p class="game-hint">Voit vaihtaa vastaustasi, kunnes kaikki ovat vastanneet tai aika loppuu.</p>'}
    </div>${renderPlayers('question')}</section>`;
  updateClock();
}
function renderFinished() {
  const sorted = [...state.players].sort((a,b) => b.score-a.score);
  const winner = sorted[0];
  const topNames = sorted.filter(p => p.score===winner.score).map(p=>p.name);
  document.title = 'Lopputulokset — Nörttien Arvauskeskus';
  app.innerHTML = `<section class="podium"><div class="eyebrow">KILPAILU PÄÄTTYNYT</div><div class="winner-trophy">🏆</div>
    <h1 class="winner-name">${escapeHtml(topNames.join(' & '))}</h1><p>${topNames.length===1?'Onnittelut voittajalle!':'Tasapeli kärjessä!'} Paras pistemäärä: <strong class="highlight">${winner.score.toLocaleString('fi-FI')} p</strong></p></section>
    <section class="finish-board"><div class="panel"><div class="player-header"><h2>Lopputulokset</h2><span class="count-pill">${sorted.length} pelaajaa</span></div><div class="player-list">
    ${sorted.map((p,i)=>`<div class="player"><span class="rank-num">${i+1}.</span><span class="avatar ${i%2?'alt':''}">${escapeHtml(p.name.charAt(0).toUpperCase())}</span><div class="player-grow"><span class="player-name">${escapeHtml(p.name)}${p.id===state.meId?'<span class="player-me">(sinä)</span>':''}</span></div><span class="score">${p.score.toLocaleString('fi-FI')} p</span></div>`).join('')}</div>
    <div class="divider"></div><button class="btn btn-primary btn-full" data-action="leave">Pelaa uusi peli →</button></div></section>`;
}
function updateClock() {
  if (!state || !['question','reveal'].includes(state.status)) return;
  const bar = document.querySelector('#timer-bar');
  const number = document.querySelector('#timer-value');
  if (!bar || !number) return;
  const now = Date.now() + clockOffset;
  const duration = state.status==='question' ? state.timer * 1000 : 6000;
  const started = Date.parse(state.status==='question' ? state.startedAt : state.revealAt);
  const left = Math.max(0,duration-(now-started));
  bar.style.width = `${Math.min(100,(left/duration)*100)}%`;
  bar.classList.toggle('low',left<5000);
  number.textContent = Math.ceil(left/1000) + ' s';
  if (state.status==='question' && left===0) {
    document.querySelectorAll('[data-action="answer"]:not(:disabled)').forEach(button => button.disabled=true);
  }
}
function render() {
  if (!identity) return renderHome();
  if (!state) {app.innerHTML='<div class="loading"><span class="spinner"></span> Yhdistetään pelihuoneeseen...</div>';return;}
  if (state.status==='lobby') {
    // Tilan päivitys ei saa sulkea pelaajan avointa alasvetovalikkoa.
    if (busy || document.activeElement?.id!=='player-topic') renderLobby();
  }
  else if (state.status==='question'||state.status==='reveal') renderQuestion();
  else if (state.status==='finished') renderFinished();
}
function poll() {
  if (!identity) return;
  if (!polling) polling = refreshState(identity).finally(() => {polling=null;});
  return polling;
}
async function refreshState(player) {
  try {
    const next = await api('state',credentials());
    if (identity!==player) return;
    clockOffset = Date.parse(next.serverNow)-Date.now();
    const key = `${next.status}/${next.roundIndex}`;
    const wasDifferent = key !== lastRoundKey;
    state = next;
    lastRoundKey = key;
    render();
    if (wasDifferent && next.status==='finished') toast('Kilpailu päättyi!');
  } catch (err) {
    if (identity!==player) return;
    // Verkon väliaikainen katkeaminen ei vie pelaajaa pois huoneesta.
    if (err.message.includes('tunniste ei kelpaa') || err.message.includes('Pelaajaa ei löytynyt')) {
      toast('Peli-istunto ei ole enää voimassa. Liity huoneeseen uudelleen.');
      identity = null; state = null; renderHome();
    } else {
      console.warn(err.message);
      if (!state) toast(err.message);
    }
  }
}
app.addEventListener('submit', async event => {
  if (!['create-form','join-form'].includes(event.target.id)) return;
  event.preventDefault();
  if (busy) return;
  busy = true;
  const form = new FormData(event.target);
  const isCreate = event.target.id === 'create-form';
  const values = Object.fromEntries(form.entries());
  const button = event.target.querySelector('button[type="submit"]');
  if (button) {button.disabled=true; button.textContent=isCreate?'Luodaan peliä...':'Liitytään...';}
  try {
    const result = await api(isCreate?'create':'join',isCreate ? {
      name:values['create-name'], topicMode:values['topic-mode'], total:Number(values.total),
      timer:Number(values.timer), difficulty:values.difficulty
    } : {name:values['join-name'],code:values['join-code']});
    saveIdentity(result);
    state = null;
    render();
    await poll();
  } catch(err) {
    toast(err.message);
    if(button){button.disabled=false;button.textContent=isCreate?'Luo peli →':'Liity peliin →';}
  } finally {
    busy=false;
    if (identity && state) render();
  }
});
app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action==='leave') return reset();
  if (action==='copy-code'||action==='copy-link') {
    const value = action==='copy-code'?state.code:new URL('?room='+state.code,location.href).href;
    try {await navigator.clipboard.writeText(value);toast('Kopioitu leikepöydälle!');}
    catch {prompt('Kopioi tästä:',value);}
    return;
  }
  if (busy || button.disabled || (action!=='ready' && action!=='answer')) return;
  const payload = action==='ready'
    ? {ready:button.dataset.ready==='true'}
    : {choice:Number(button.dataset.choice), roundIndex:state.roundIndex};
  await changeRoom(action,payload);
});
app.addEventListener('change', async event => {
  if (event.target.id!=='player-topic' || state?.status!=='lobby') return;
  await changeRoom('topic',{topic:event.target.value});
});
async function changeRoom(action,payload) {
  if (busy || !identity) return;
  const player = identity;
  busy=true;
  render();
  try {
    await api(action, {...credentials(),...payload});
  } catch(err) {
    if (identity===player) toast(err.message);
  } finally {
    // Mutation jälkeen tarvitaan uusi tilahaku, vaikka edellinen olisi vielä kesken.
    await polling;
    if (identity===player) await poll();
    busy=false;
    render();
  }
}
function init() {
  const room = (new URLSearchParams(location.search).get('room')||'').toUpperCase();
  if (/^[A-HJ-NP-Z2-9]{6}$/.test(room)) {
    try {
      const stored = JSON.parse(localStorage.getItem('visa:'+room) || 'null');
      if (stored?.secret && stored?.playerId && stored?.code===room) identity=stored;
    } catch { /* no saved player */ }
  }
  render();
  if(identity) poll();
  window.setInterval(() => {if(identity) poll();},1250);
  window.setInterval(updateClock,160);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&identity)poll();});
}
init();
