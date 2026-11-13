// AutoLink · funções extras: perfil, ausência, acidente, manutenção, documentos, avaliação de frota, avisos.
/* global m, S, api, add, update, find, go, toast, ic, esc, poll, unpack, fields, Home, BASE, timer */

// ---------- Validação CPF / CNPJ ----------
function onlyDigits(v) { return String(v || '').replace(/\D/g, ''); }
function validCPF(c) {
  c = onlyDigits(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +c[t]) return false; }
  return true;
}
function validCNPJ(c) {
  c = onlyDigits(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = n => { const w = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < n; i++) s += +c[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +c[12] && calc(13) === +c[13];
}
function maskDoc(d) {
  d = onlyDigits(d);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
}
const el = id => document.getElementById(id);

// ---------- Perfil ----------
let PROFILE = null;
async function loadProfile() {
  try { PROFILE = unpack(await api('/profiles/' + S.uid)); } catch (e) { PROFILE = null; }
  return PROFILE;
}
async function gateProfile() {
  await loadProfile();
  if (!PROFILE) return go(ProfileForm, { first: true });
  go(Home); startNotifier();
}
function ProfileForm(opt = {}) {
  const p = PROFILE || {}, locked = !!PROFILE;
  m.innerHTML = `<h2>${opt.first ? 'Complete seu cadastro' : 'Meu perfil'}</h2>
  ${opt.first ? '<p class="muted">Para a segurança de todos, precisamos de alguns dados. Eles <b>nunca</b> são mostrados para quem escaneia seu adesivo.</p>' : ''}
  <form id="pf">
   <div class="muted" style="margin:8px 0 4px">Dados pessoais ${locked ? '🔒 (não podem ser alterados)' : ''}</div>
   <input id="pn" placeholder="Nome completo ou razão social" value="${esc(p.name || '')}" ${locked ? 'disabled' : 'required'} maxlength="100">
   <input id="pd" placeholder="CPF ou CNPJ" inputmode="numeric" value="${esc(locked ? maskDoc(p.doc) : '')}" ${locked ? 'disabled' : 'required'} maxlength="18">
   <div class="muted" style="margin:8px 0 4px">Contato</div>
   <input value="${esc(S.email || '')}" disabled title="E-mail da conta">
   <input id="pt" placeholder="Telefone / WhatsApp (com DDD)" inputmode="tel" value="${esc(p.phone || '')}" required maxlength="20">
   <div class="muted" style="margin:8px 0 4px">Endereço</div>
   <input id="pc" placeholder="CEP" inputmode="numeric" value="${esc(p.cep || '')}" maxlength="9">
   <input id="pa" placeholder="Rua / avenida" value="${esc(p.street || '')}" required maxlength="120">
   <div style="display:flex;gap:8px"><input id="pnum" placeholder="Número" value="${esc(p.num || '')}" required maxlength="10" style="width:120px"><input id="pcomp" placeholder="Complemento (opcional)" value="${esc(p.comp || '')}" maxlength="60"></div>
   <input id="pb" placeholder="Bairro" value="${esc(p.district || '')}" maxlength="80">
   <div style="display:flex;gap:8px"><input id="pci" placeholder="Cidade" value="${esc(p.city || '')}" required maxlength="80"><input id="puf" placeholder="UF" value="${esc(p.uf || '')}" required maxlength="2" style="width:80px;text-transform:uppercase"></div>
   <div class="muted" style="margin:8px 0 4px">👨‍👩‍👧 Contato de emergência (família)</div>
   <input id="fn" placeholder="Nome do familiar" value="${esc(p.famName || '')}" required maxlength="80">
   <input id="fr" placeholder="Parentesco (ex: esposa, pai, filho)" value="${esc(p.famRel || '')}" maxlength="40">
   <input id="ft" placeholder="Telefone do familiar (com DDD)" inputmode="tel" value="${esc(p.famPhone || '')}" required maxlength="20">
   <button class="btn" id="ps">${opt.first ? 'Concluir cadastro' : 'Salvar alterações'}</button>
  </form>${opt.first ? '' : '<p class="muted">Para mudar o e-mail da conta, fale com a Central de ajuda.</p>'}`;
  const cep = el('pc');
  cep.oninput = async () => {
    const d = onlyDigits(cep.value); if (d.length !== 8) return;
    try { const r = await (await fetch('https://viacep.com.br/ws/' + d + '/json/')).json();
      if (!r.erro) { if (!el('pa').value) el('pa').value = r.logradouro || ''; el('pb').value = r.bairro || ''; el('pci').value = r.localidade || ''; el('puf').value = r.uf || ''; el('pnum').focus(); } } catch (e) {}
  };
  el('pf').onsubmit = async e => {
    e.preventDefault(); const b = el('ps');
    const data = { phone: el('pt').value.trim(), cep: onlyDigits(cep.value), street: el('pa').value.trim(), num: el('pnum').value.trim(), comp: el('pcomp').value.trim(), district: el('pb').value.trim(),
      city: el('pci').value.trim(), uf: el('puf').value.trim().toUpperCase(), famName: el('fn').value.trim(), famRel: el('fr').value.trim(), famPhone: el('ft').value.trim(), updatedAt: new Date() };
    if (onlyDigits(data.phone).length < 10 || onlyDigits(data.famPhone).length < 10) return toast('Confira os telefones (com DDD)');
    b.disabled = true; b.textContent = 'Salvando...';
    try {
      if (!locked) {
        const d = onlyDigits(el('pd').value);
        if (!(d.length === 11 ? validCPF(d) : validCNPJ(d))) { b.disabled = false; b.textContent = 'Concluir cadastro'; return toast('CPF ou CNPJ inválido'); }
        Object.assign(data, { name: el('pn').value.trim(), doc: d, docType: d.length === 11 ? 'cpf' : 'cnpj', email: S.email || '', createdAt: new Date() });
        await api('/profiles/' + S.uid, 'PATCH', { fields: fields(data) });
      } else await update('profiles/' + S.uid, data);
      await loadProfile();
      if (opt.first) { toast('Cadastro concluído! ✅'); go(Home); startNotifier(); } else { toast('Perfil salvo ✅'); }
    } catch (err) { alert('Erro ao salvar: ' + err.message); }
    b.disabled = false; b.textContent = opt.first ? 'Concluir cadastro' : 'Salvar alterações';
  };
}

// ---------- Avisos (enquanto o app está aberto) ----------
let notifTimer = null;
function startNotifier() {
  if (notifTimer || !S) return;
  let since = Date.now();
  notifTimer = setInterval(async () => {
    if (!S) return;
    try {
      const chats = await allChats(); setUnread(chats);
      const fresh = chats.filter(c => c.updatedAt && +c.updatedAt > since && !String(c.lastMsg || '').startsWith('Você:') && !c.blocked);
      if (fresh.length) {
        since = Date.now(); const t = fresh[0].lastMsg || 'Nova mensagem sobre seu carro';
        toast('🔔 ' + t); if (navigator.vibrate) navigator.vibrate([250, 120, 250]); if (pref('sound') !== 'off') beep();
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          try { (await navigator.serviceWorker?.getRegistration())?.showNotification('AutoLink', { body: t, icon: 'icon3-192.png' }) || new Notification('AutoLink', { body: t }); } catch (e) {}
        }
      }
    } catch (e) {}
  }, 15000);
}
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .15; o.start(); setTimeout(() => { o.frequency.value = 1320; }, 150); setTimeout(() => { o.stop(); a.close(); }, 320); } catch (e) {} }
async function askNotif() {
  if (!('Notification' in window)) return alert('Este celular não permite notificações neste modo.\n\nNo iPhone: instale o AutoLink na tela inicial. Enquanto o app estiver aberto você recebe aviso com som e vibração.');
  const r = await Notification.requestPermission();
  alert(r === 'granted' ? '🔔 Notificações ativadas! Você será avisado enquanto o AutoLink estiver aberto ou em segundo plano.' : 'Notificações bloqueadas. Você pode liberar nos ajustes do celular.');
}

// ---------- Mensagem de ausência ----------
const AWAY_PRESETS = ['Estou no trabalho. Volto mais tarde.', 'Estou em reunião. Respondo assim que puder.', 'Estou dirigindo. Respondo em breve.', 'Estou viajando. Fale com o porteiro do prédio.', 'Volto em 10 minutos.'];
function Away() {
  m.innerHTML = `<h2>Mensagem de ausência</h2>
  <div class="card"><b>Como funciona</b><p class="muted" style="margin:6px 0 0">Quando você não puder responder, deixe uma mensagem automática. Quem escanear seu adesivo recebe essa resposta na hora.
  Ela vale por <b>no máximo 12 horas</b>. Quando acabar, o AutoLink te avisa para renovar.</p></div>
  <div id="awst"></div>
  <div class="muted" style="margin:14px 0 6px">Escolha uma mensagem</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${AWAY_PRESETS.map(t => `<button class="chip" data-p>${t}</button>`).join('')}</div>
  <textarea id="awt" maxlength="200" placeholder="Ou escreva sua mensagem"></textarea>
  <div class="muted" style="margin:4px 0 6px">Por quanto tempo?</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${[1, 2, 4, 8, 12].map(h => `<button class="chip" data-h="${h}">${h} h</button>`).join('')}</div>
  <div class="row"><span>Ou até o horário</span><input type="time" id="awu" style="width:130px;margin:0"></div>
  <p class="muted" id="awinfo"></p>
  <button class="btn" id="aws">Ativar ausência</button>`;
  let until = null;
  const info = () => { el('awinfo').textContent = until ? 'Vale até ' + until.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
  m.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { el('awt').value = b.textContent; });
  m.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { until = new Date(Date.now() + b.dataset.h * 3600e3); m.querySelectorAll('[data-h]').forEach(x => x.style.borderColor = x === b ? 'var(--or)' : ''); el('awu').value = ''; info(); });
  el('awu').onchange = () => { const [h, mi] = el('awu').value.split(':').map(Number); const d = new Date(); d.setHours(h, mi, 0, 0); if (d < Date.now()) d.setDate(d.getDate() + 1);
    if (d - Date.now() > 12 * 3600e3) { toast('Máximo de 12 horas'); el('awu').value = ''; until = null; } else until = d; info(); };
  const loadSt = async () => { const cars = await find('cars', [['ownerId', S.uid]]); const a = cars.find(c => c.awayUntil && +c.awayUntil > Date.now());
    el('awst').innerHTML = a ? `<div class="card" style="border-color:var(--or)">🟠 <b>Ausência ativa</b> até ${a.awayUntil.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<div class="muted">"${esc(a.awayText)}"</div><button class="chip" id="awoff" style="margin-top:8px">Desativar agora</button></div>` : '';
    const off = el('awoff'); if (off) off.onclick = async () => { await setAway(cars, '', new Date(0)); loadSt(); toast('Ausência desativada'); }; return cars; };
  let carsP = loadSt();
  el('aws').onclick = async () => {
    const t = el('awt').value.trim(); if (!t) return toast('Escolha ou escreva a mensagem'); if (!until) return toast('Escolha por quanto tempo');
    const cars = await carsP; if (!cars.length) return toast('Cadastre um carro primeiro');
    try { await setAway(cars, t, until); toast('Ausência ativada ✅'); carsP = loadSt(); } catch (e) { alert('Erro: ' + e.message); }
  };
}
async function setAway(cars, text, until) { for (const c of cars) await update('cars/' + c.id, { awayText: text, awayUntil: until }); }

// ---------- Extras da tela inicial: ausência expirada + lembretes ----------
async function homeExtras() {
  const box = el('xtra'); if (!box) return;
  let html = '';
  try {
    const cars = await find('cars', [['ownerId', S.uid]]);
    const act = cars.find(c => c.awayUntil && +c.awayUntil > Date.now());
    const exp = cars.find(c => c.awayText && c.awayUntil && +c.awayUntil <= Date.now() && +c.awayUntil > 0);
    awayTimer(act);
    if (!act && exp) html += `<div class="card" style="border-color:var(--or)">⏰ <b>Sua mensagem de ausência terminou.</b><div class="muted">"${esc(exp.awayText)}"</div><div style="display:flex;gap:8px;margin-top:8px"><button class="chip" id="awr">Renovar</button><button class="chip" id="awx">Dispensar</button></div></div>`;
    const rem = (await find('maint', [], null, '/owners/' + S.uid)).filter(x => x.remind && +x.remind - Date.now() < 15 * 864e5).sort((a, b) => a.remind - b.remind);
    if (rem.length) html += `<h2>Lembretes</h2>` + rem.slice(0, 3).map(r => { const late = +r.remind < Date.now(); const car = cars.find(c => c.id === r.carId);
      return `<div class="card alert"><span class="ic ${late ? '' : 'or'}" style="${late ? 'background:#ef44441f' : ''}">${late ? '⚠️' : '🔧'}</span><div><b style="font-size:15px">${esc(r.kind)}${car ? ' · ' + esc(car.name) : ''}</b><div class="muted">${late ? 'Venceu em' : 'Vence em'} ${r.remind.toLocaleDateString('pt-BR')}</div></div></div>`; }).join('');
    box.innerHTML = html;
    if (el('awr')) el('awr').onclick = () => go(Away);
    if (el('awx')) el('awx').onclick = async () => { await setAway(cars.filter(c => c.awayText), '', new Date(0)); homeExtras(); };
  } catch (e) {}
}

// ---------- Acidente ----------
function shrinkImage(file, max = 1100, q = .6) {
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
    c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', q)); };
    img.onerror = no; img.src = URL.createObjectURL(file); });
}
function Accident() {
  m.innerHTML = `<h2>🚑 Registrar acidente</h2>
  <div class="card"><b>Como funciona</b><p class="muted" style="margin:6px 0 0">Se você sofreu um acidente de carro, tire uma foto e envie. A equipe AutoLink analisa e <b>entra em contato com o seu contato de emergência</b> (família).</p></div>
  <div class="warn" style="margin-top:8px">🚨 Em caso de feridos, ligue <b>192 (SAMU)</b> ou <b>193 (Bombeiros)</b> antes de tudo.</div>
  <label class="btn" style="display:block;text-align:center;margin-top:14px">📷 Tirar foto do acidente<input type="file" accept="image/*" capture="environment" id="acf" hidden></label>
  <img id="acp" style="width:100%;border-radius:14px;display:none;margin-bottom:10px">
  <textarea id="acd" maxlength="300" placeholder="O que aconteceu? (opcional)"></textarea>
  <div class="card gps"><span style="font-size:22px">📍</span><div style="flex:1"><b style="font-size:15px">Localização</b><div class="muted" id="acg">Toque para incluir onde você está</div></div><button class="chip" id="acl">Incluir</button></div>
  <button class="btn" id="acs">Enviar para a equipe</button>
  <h2>Meus registros</h2><div id="acl2"><p class="muted">Carregando...</p></div>`;
  let photo = null, pos = null;
  el('acf').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { photo = await shrinkImage(f); el('acp').src = photo; el('acp').style.display = 'block'; } catch (err) { toast('Não foi possível ler a foto'); } };
  el('acl').onclick = () => { el('acg').textContent = 'Obtendo...'; gps().then(p => { pos = p; el('acg').textContent = 'Localização incluída ✅'; }).catch(() => { el('acg').textContent = 'Não foi possível pegar o GPS'; }); };
  el('acs').onclick = async () => {
    if (!photo) return toast('Tire a foto do acidente');
    if (!PROFILE) await loadProfile();
    const b = el('acs'); b.disabled = true; b.textContent = 'Enviando...';
    try { await add('accidents', { authorId: S.uid, email: S.email || '', desc: el('acd').value.trim(), photo, lat: pos ? String(pos.lat) : '', lng: pos ? String(pos.lng) : '', status: 'pending', createdAt: new Date() });
      alert('Registro enviado ✅\n\nNossa equipe vai analisar e entrar em contato com seu contato de emergência.'); go(Accident, null, false);
    } catch (e) { alert('Erro: ' + e.message); b.disabled = false; b.textContent = 'Enviar para a equipe'; }
  };
  find('accidents', [['authorId', S.uid]]).then(l => { const box = el('acl2'); if (!box) return;
    const ST = { pending: '⏳ Em análise', contacted: '✅ Família avisada', rejected: '❌ Não aprovado' };
    box.innerHTML = l.length ? l.sort((a, b) => b.createdAt - a.createdAt).map(a => `<div class="card"><b>${ST[a.status] || a.status}</b><div class="muted">${a.createdAt ? a.createdAt.toLocaleString('pt-BR') : ''} ${a.desc ? '· ' + esc(a.desc) : ''}</div></div>`).join('') : '<p class="muted">Nenhum registro.</p>';
  }).catch(() => {});
}

// ---------- Manutenção ----------
const MKINDS = ['Troca de óleo', 'Revisão', 'Pneus', 'Freios', 'Bateria', 'Alinhamento e balanceamento', 'Filtros', 'IPVA', 'Licenciamento', 'Seguro', 'Outro'];
async function Maint() {
  m.innerHTML = `<h2>🔧 Manutenção</h2><p class="muted">Registre o que foi feito e receba lembretes na tela inicial.</p>
  <button class="card" id="goCal" style="display:flex;gap:12px;align-items:center;border-color:var(--or)"><span style="font-size:26px">📅</span><div><b>Calendário do carro</b><div class="muted">Rodízio, IPVA e licenciamento pela placa</div></div></button>
  <div class="card"><b>Novo registro</b>
   <select id="mc" class="sel"></select><select id="mk" class="sel">${MKINDS.map(k => `<option>${k}</option>`).join('')}</select>
   <div style="display:flex;gap:8px"><input id="md" type="date" title="Data"><input id="mkm" inputmode="numeric" placeholder="Km"></div>
   <input id="mv" inputmode="decimal" placeholder="Valor (R$)">
   <input id="mn" placeholder="Observação (ex: oficina, peça)" maxlength="150">
   <div class="muted" style="margin:2px 0 4px">⏰ Lembrar em (opcional)</div><input id="mr" type="date">
   <button class="btn" id="ms">Salvar</button></div>
  <h2>Histórico</h2><div id="ml"><p class="muted">Carregando...</p></div>`;
  el('goCal').onclick = () => go(Calendar);
  el('md').valueAsDate = new Date();
  const cars = await find('cars', [['ownerId', S.uid]]);
  el('mc').innerHTML = cars.length ? cars.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : '<option value="">Cadastre um carro primeiro</option>';
  const list = async () => { const l = (await find('maint', [], null, '/owners/' + S.uid)).sort((a, b) => (b.done || 0) - (a.done || 0)); const box = el('ml'); if (!box) return;
    box.innerHTML = l.length ? '' : '<p class="muted">Nenhum registro ainda.</p>';
    for (const r of l) { const car = cars.find(c => c.id === r.carId); const d = document.createElement('div'); d.className = 'card';
      d.innerHTML = `<div style="display:flex;gap:8px;align-items:start"><div style="flex:1"><b>${esc(r.kind)}</b> <span class="muted">· ${esc(car ? car.name : '')}</span>
      <div class="muted">${r.done ? r.done.toLocaleDateString('pt-BR') : ''}${r.km ? ' · ' + esc(r.km) + ' km' : ''}${r.value ? ' · R$ ' + esc(r.value) : ''}</div>
      ${r.note ? `<div class="muted">${esc(r.note)}</div>` : ''}${r.remind ? `<div class="muted">⏰ Lembrete: ${r.remind.toLocaleDateString('pt-BR')}</div>` : ''}</div><button class="chip" aria-label="Apagar">🗑</button></div>`;
      d.querySelector('button').onclick = async () => { if (!confirm('Apagar este registro?')) return; await api('/owners/' + S.uid + '/maint/' + r.id, 'DELETE'); list(); };
      box.appendChild(d); } };
  list();
  el('ms').onclick = async () => {
    if (!el('mc').value) return toast('Cadastre um carro primeiro');
    const data = { carId: el('mc').value, kind: el('mk').value, km: onlyDigits(el('mkm').value), value: el('mv').value.trim(), note: el('mn').value.trim(), createdAt: new Date() };
    if (el('md').value) data.done = new Date(el('md').value + 'T12:00:00'); if (el('mr').value) data.remind = new Date(el('mr').value + 'T09:00:00');
    try { await add('owners/' + S.uid + '/maint', data); toast('Registro salvo ✅'); el('mkm').value = el('mv').value = el('mn').value = el('mr').value = ''; list(); } catch (e) { alert('Erro: ' + e.message); }
  };
}

// ---------- Documentos (PDF e fotos) ----------
const DKINDS = ['CNH', 'CRLV (documento do carro)', 'Apólice de seguro', 'Nota fiscal', 'Laudo / vistoria', 'Outro'];
const CHUNK = 700000;
async function Docs() {
  m.innerHTML = `<h2>📄 Documentos</h2><p class="muted">Guarde CNH, documento do carro, seguro e outros. Arquivos PDF ou foto, até 5 MB.</p>
  <div class="card"><b>Enviar documento</b><select id="dk" class="sel">${DKINDS.map(k => `<option>${k}</option>`).join('')}</select>
   <input id="dn" placeholder="Nome (ex: CNH Filipe)" maxlength="60">
   <label class="btn" style="display:block;text-align:center">📎 Escolher arquivo (PDF ou foto)<input type="file" id="df" accept="application/pdf,image/*" hidden></label>
   <p class="muted" id="dst"></p></div>
  <h2>Meus documentos</h2><div id="dl"><p class="muted">Carregando...</p></div>`;
  const list = async () => { const l = (await find('docs', [], null, '/owners/' + S.uid)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); const box = el('dl'); if (!box) return;
    box.innerHTML = l.length ? '' : '<p class="muted">Nenhum documento ainda.</p>';
    for (const d of l) { const r = document.createElement('div'); r.className = 'card'; r.style.cssText = 'display:flex;gap:10px;align-items:center';
      r.innerHTML = `<span style="font-size:26px">${String(d.mime).includes('pdf') ? '📕' : '🖼️'}</span><div style="flex:1;min-width:0"><b style="font-size:15px">${esc(d.name)}</b><div class="muted">${esc(d.kind)} · ${(d.size / 1024 / 1024).toFixed(1)} MB</div></div><button class="chip" data-v>Abrir</button><button class="chip" data-x aria-label="Apagar">🗑</button>`;
      r.querySelector('[data-v]').onclick = () => openDoc(d, r.querySelector('[data-v]'));
      r.querySelector('[data-x]').onclick = async () => { if (!confirm('Apagar este documento?')) return; const p = '/owners/' + S.uid + '/docs/' + d.id;
        for (let i = 0; i < +d.chunks; i++) await api(p + '/chunks/' + i, 'DELETE').catch(() => {}); await api(p, 'DELETE'); list(); };
      box.appendChild(r); } };
  list();
  el('df').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) return toast('Arquivo maior que 5 MB');
    const st = el('dst'); st.textContent = 'Enviando...';
    try {
      const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
      const n = Math.ceil(b64.length / CHUNK);
      const meta = await add('owners/' + S.uid + '/docs', { name: el('dn').value.trim() || f.name, kind: el('dk').value, mime: f.type || 'application/octet-stream', size: String(f.size), chunks: String(n), createdAt: new Date() });
      for (let i = 0; i < n; i++) { st.textContent = `Enviando... ${Math.round((i + 1) / n * 100)}%`;
        await api('/owners/' + S.uid + '/docs/' + meta.id + '/chunks/' + i, 'PATCH', { fields: { d: { stringValue: b64.slice(i * CHUNK, (i + 1) * CHUNK) } } }); }
      st.textContent = 'Documento salvo ✅'; el('dn').value = ''; e.target.value = ''; list();
    } catch (err) { st.textContent = ''; alert('Erro ao enviar: ' + err.message); }
  };
}
async function openDoc(d, btn) {
  const w = window.open('', '_blank'); btn.textContent = '...';
  try { let b64 = ''; for (let i = 0; i < +d.chunks; i++) b64 += (await api('/owners/' + S.uid + '/docs/' + d.id + '/chunks/' + i)).fields.d.stringValue;
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u], { type: d.mime })); if (w) w.location = url; else location.href = url;
  } catch (e) { if (w) w.close(); alert('Erro ao abrir: ' + e.message); }
  btn.textContent = 'Abrir';
}

// ---------- Frota: "Como estou dirigindo?" ----------
async function carExtras(car) {
  const box = el('fleet'); if (!box) return;
  box.innerHTML = `<div class="row"><span>🏢 Veículo de empresa<br><small class="muted">Mostra "Como estou dirigindo?" para quem escanear</small></span><label class="sw"><input type="checkbox" id="flt" ${car.fleet ? 'checked' : ''}><span></span></label></div><div id="rts"></div>`;
  el('flt').onchange = async e => { car.fleet = e.target.checked; try { await update('cars/' + car.id, { fleet: car.fleet }); carExtras(car); } catch (err) { alert(err.message); } };
  if (!car.fleet) return;
  try { const l = (await find('ratings', [['carId', car.id], ['ownerId', S.uid]])).sort((a, b) => b.at - a.at); const r = el('rts'); if (!r) return;
    const avg = l.length ? (l.reduce((s, x) => s + +x.stars, 0) / l.length).toFixed(1) : '—';
    r.innerHTML = `<div class="card"><b>Como estou dirigindo?</b><div style="font-size:28px;font-weight:900;color:var(--or)">⭐ ${avg} <small class="muted" style="font-size:13px">(${l.length} avaliações)</small></div>
     ${l.slice(0, 10).map(x => `<div style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px">${'⭐'.repeat(+x.stars)}<div class="muted">${x.comment ? esc(x.comment) + ' · ' : ''}${x.at ? x.at.toLocaleString('pt-BR') : ''}</div></div>`).join('')}</div>`;
  } catch (e) {}
}

// ---------- Meu QR ----------
async function MyQR() {
  m.innerHTML = `<h2>Meu QR code</h2><p class="muted">O QR e o código dos adesivos ativos nos seus carros.</p><div id="qrs"><p class="muted">Carregando...</p></div>`;
  const cars = await find('cars', [['ownerId', S.uid]]); const box = el('qrs'); if (!box) return;
  const withQ = cars.filter(c => c.stickerCode);
  if (!withQ.length) { box.innerHTML = `<div class="card">Você ainda não tem adesivo ativado.<p class="muted">Vá em Garagem, toque no carro e em "Ativar adesivo".</p><button class="btn" id="gq">Ir para a Garagem</button></div>`; el('gq').onclick = () => go(Garage); return; }
  box.innerHTML = '';
  const base = new URL('./', location.href).href;
  for (const c of withQ) {
    const d = document.createElement('div'); d.className = 'card'; d.style.textAlign = 'center';
    d.innerHTML = `<b style="font-size:18px">${esc(c.name)}</b><div class="muted">${esc(c.plate || '')} · ${c.active ? '🟢 Ativo' : '⏸ Pausado'}</div>
      <div class="qrw"><div class="qrb"></div></div><div class="code">${esc(c.stickerCode)}</div><div class="muted" style="margin-top:4px">Código do adesivo</div>`;
    box.appendChild(d);
    const t = () => window.QRCode ? new QRCode(d.querySelector('.qrb'), { text: base + '?s=' + c.stickerCode, width: 220, height: 220, colorDark: '#111', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M }) : setTimeout(t, 200);
    t();
  }
}

// ---------- Alertas na minha região (prévia do mapa) ----------
async function regionMap() {
  const box = el('rmap'); if (!box) return;
  let n = 0, near = false;
  try { const st = await navigator.permissions?.query({ name: 'geolocation' });
    if (st && st.state === 'granted') { const p = await gps(); const l = await find('alerts', [['status', 'approved']]);
      n = l.filter(a => !(a.expiresAt && +a.expiresAt < Date.now()) && dist(p.lat, p.lng, +a.lat, +a.lng) <= 5000).length; near = true; } } catch (e) {}
  box.innerHTML = `<div class="card rm" style="padding:0;overflow:hidden">
   <svg viewBox="0 0 400 110" style="display:block;width:100%;height:auto">
    <rect width="400" height="110" fill="var(--card2)"/>
    <g stroke="var(--line)" stroke-width="5" fill="none"><path d="M-10 40 L410 26"/><path d="M-10 88 L410 80"/><path d="M90 -10 L110 120"/><path d="M260 -10 L285 120"/></g>
    <g stroke="var(--line)" stroke-width="2" fill="none" opacity=".7"><path d="M-10 62 L410 54"/><path d="M180 -10 L192 120"/><path d="M340 -10 L352 120"/><path d="M30 -10 L42 120"/></g>
    <path d="M300 8 q30 14 60 6 q20 -4 40 4 v-18 h-100z" fill="#3b82f633"/>
    <circle cx="200" cy="56" r="32" fill="#FF6B0018" stroke="#FF6B0066" stroke-dasharray="4 4"/>
    <circle cx="200" cy="56" r="6" fill="#FF6B00"/><circle cx="200" cy="56" r="11" fill="none" stroke="#FF6B00" stroke-width="2" opacity=".6"/>
   </svg>
   <div style="padding:9px 14px;display:flex;align-items:center;gap:10px"><span style="font-size:20px">${n ? '⚠️' : '✅'}</span><div><b style="font-size:15px">${n ? n + ' alerta(s) na sua região' : 'Zero alertas na sua região'}</b>
    <div class="muted">${near ? 'Num raio de 5 km de você.' : 'Mapa em construção. Permita a localização ao criar um alerta para ver os da sua região.'}</div></div></div></div>`;
}

// ---------- Empresa ----------
function Company() {
  const F = [['🚚', 'QR para frota', 'Adesivos AutoLink para todos os veículos da empresa, gerenciados em um só lugar.'],
    ['⭐', 'Como estou dirigindo?', 'Receba avaliações de quem vê seus motoristas na rua. Ative em cada carro: Garagem → carro → "Veículo de empresa".', 1],
    ['👥', 'Motoristas', 'Cadastre motoristas e saiba quem está com cada veículo.'],
    ['📊', 'Relatórios', 'Avaliações, ocorrências e manutenções de toda a frota.'],
    ['🔧', 'Manutenção da frota', 'Lembretes de revisão, IPVA e licenciamento de todos os veículos.'],
    ['🚑', 'Ocorrências', 'Acidentes e alertas envolvendo veículos da empresa.']];
  m.innerHTML = `<h2>🏢 AutoLink para empresas</h2><p class="muted">Soluções para quem tem frota: transportadoras, entregas, locadoras, aplicativos e empresas de serviço.</p>
   ${F.map(([e, t, d, ok]) => `<button class="card cf" style="display:flex;gap:12px;align-items:center" data-ok="${ok ? 1 : ''}"><span style="font-size:28px">${e}</span><div style="flex:1"><b>${t}</b> ${ok ? '<span class="pill" style="margin:0">Disponível</span>' : '<span class="pill" style="margin:0;background:#3a3a40;color:var(--mut)">Em breve</span>'}<div class="muted">${d}</div></div></button>`).join('')}
   <button class="btn" id="cq" style="margin-top:8px">Quero o AutoLink na minha empresa</button>`;
  m.querySelectorAll('.cf').forEach(b => b.onclick = () => b.dataset.ok ? go(Garage) : toast('🚧 ' + b.querySelector('b').textContent + ': em construção. Em breve!'));
  el('cq').onclick = () => go(Advertise, 'company');
}

// ---------- Não lidas (sino + contador por carro) ----------
let UNREAD = {}, UNREAD_LIST = [];
function isUnread(c) { return !c.blocked && c.updatedAt && !String(c.lastMsg || '').startsWith('Você:') && (!c.seenAt || +c.updatedAt > +c.seenAt); }
function setUnread(chats) {
  UNREAD = {}; UNREAD_LIST = chats.filter(isUnread);
  for (const c of UNREAD_LIST) UNREAD[c.carId] = (UNREAD[c.carId] || 0) + 1;
  const n = UNREAD_LIST.length, b = el('bellN'); if (b) { b.textContent = n > 9 ? '9+' : n; b.classList.toggle('on', n > 0); }
}
async function refreshUnread(cars) { try { setUnread(await allChats(cars || await allCars())); } catch (e) {} }
async function Notifs() {
  m.innerHTML = `<h2>🔔 Notificações</h2><div id="nl"><p class="muted">Carregando...</p></div>`;
  const cars = await allCars(), chats = await allChats(cars);
  setUnread(chats); const box = el('nl'); if (!box) return;
  const items = [];
  for (const c of UNREAD_LIST.sort((a, b) => b.updatedAt - a.updatedAt)) { const car = cars.find(x => x.id === c.carId); if (car) items.push({ ic: '💬', t: esc(c.lastMsg), s: esc(car.name) + ' · ' + c.updatedAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), go: () => { stack.length = 0; stack.push([Home]); go(Chat, { car, chatId: c.id }); } }); }
  const exp = cars.find(c => c.awayText && c.awayUntil && +c.awayUntil <= Date.now() && +c.awayUntil > 0);
  if (exp) items.push({ ic: '⏰', t: 'Sua mensagem de ausência terminou', s: 'Toque para renovar', go: () => go(Away) });
  try { const acc = await find('accidents', [['authorId', S.uid]]); for (const a of acc.filter(a => a.status === 'contacted' && a.reviewedAt && Date.now() - a.reviewedAt < 7 * 864e5)) items.push({ ic: '🚑', t: 'Sua família foi avisada sobre o acidente', s: a.reviewedAt.toLocaleString('pt-BR'), go: () => go(Accident) }); } catch (e) {}
  try { const tk = await find('tickets', [['userId', S.uid]]); for (const t of tk.filter(t => t.unreadUser)) items.push({ ic: '🆘', t: 'A equipe respondeu sua dúvida', s: esc(t.lastMsg), go: () => go(Ticket, t) }); } catch (e) {}
  box.innerHTML = items.length ? '' : '<div class="card alert"><span class="ic">✅</span><div>Nenhuma notificação nova.<div class="muted">Tudo certo!</div></div></div>';
  for (const it of items) { const b = document.createElement('button'); b.className = 'card alert'; b.innerHTML = `<span class="ic or" style="font-size:20px">${it.ic}</span><div style="min-width:0"><b style="font-size:15px">${it.t}</b><div class="muted">${it.s}</div></div>`; b.onclick = it.go; box.appendChild(b); }
}

// ---------- Cronômetro da ausência (tela inicial) ----------
let awayIv = null;
function awayTimer(car) {
  const box = el('awTimer'); clearInterval(awayIv); if (!box) return;
  if (!car) { box.innerHTML = ''; return; }
  const tick = () => { const b = el('awTimer'); if (!b) return clearInterval(awayIv);
    const ms = +car.awayUntil - Date.now(); if (ms <= 0) { clearInterval(awayIv); b.innerHTML = ''; homeExtras(); return; }
    const h = Math.floor(ms / 3600e3), mi = Math.floor(ms % 3600e3 / 60e3), se = Math.floor(ms % 60e3 / 1e3), z = n => String(n).padStart(2, '0');
    const tm = b.querySelector('.tm'); if (tm) { tm.textContent = `${z(h)}:${z(mi)}:${z(se)}`; return; }
    b.innerHTML = `<div class="card awt"><span style="font-size:26px">⏳</span><div style="flex:1;min-width:0"><b>Ausência ativa</b><div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">"${esc(car.awayText)}"</div></div><div style="text-align:right"><div class="tm">${z(h)}:${z(mi)}:${z(se)}</div><button class="chip" id="awEnd" style="margin-top:4px">Encerrar</button></div></div>`;
    el('awEnd').onclick = async () => { if (!confirm('Encerrar a ausência agora?')) return; const cars = await find('cars', [['ownerId', S.uid]]); await setAway(cars, '', new Date(0)); clearInterval(awayIv); el('awTimer').innerHTML = ''; toast('Ausência encerrada'); }; };
  tick(); awayIv = setInterval(tick, 1000);
}

// ---------- Foto do perfil ----------
async function drawAvatar() {
  const b = el('dAv'), inp = el('dAvI'); if (!b || !inp) return;
  if (S && !PROFILE) await loadProfile();
  const ph = PROFILE && PROFILE.photo;
  b.style.backgroundImage = ph ? `url(${ph})` : '';
  b.dataset.empty = ph ? '' : '1';
  inp.onclick = e => { if (!S || !PROFILE) { e.preventDefault(); toast('Complete seu cadastro primeiro'); } };
  inp.onchange = async () => { const f = inp.files[0]; inp.value = ''; if (!f) return;
    toast('Enviando foto...');
    try { const d = await squareImage(f, 240); await update('profiles/' + S.uid, { photo: d }); PROFILE.photo = d; drawAvatar(); toast('Foto atualizada ✅'); }
    catch (e) { alert('Não foi possível usar esta foto.\n\n' + (e && e.message ? e.message : 'Tente outra foto ou tire uma nova.')); } };
}
function squareImage(file, size) {
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const k = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, size, size); URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', .75)); };
    img.onerror = () => { const r = new FileReader(); r.onload = () => { const i2 = new Image(); i2.onload = img.onload.bind(null); i2.onerror = () => no(new Error('Formato de imagem não suportado. Tente uma foto JPG ou PNG.')); img.src = r.result; }; r.onerror = () => no(new Error('Não foi possível ler o arquivo.')); r.readAsDataURL(file); };
    img.src = URL.createObjectURL(file); });
}

// ---------- Configurações ----------
function pref(k, v) { try { if (v !== undefined) localStorage.setItem('al_' + k, v); return localStorage.getItem('al_' + k); } catch (e) { return null; } }
function applyPrefs() { document.body.classList.toggle('big-text', pref('font') === 'big'); }
function Settings() {
  const cur = theme(), big = pref('font') === 'big', snd = pref('sound') !== 'off';
  const nOk = 'Notification' in window && Notification.permission === 'granted';
  const R = (id, icn, t, d, right) => `<div class="card" style="display:flex;gap:12px;align-items:center" id="${id}"><span style="font-size:24px">${icn}</span><div style="flex:1;min-width:0"><b style="font-size:15px">${t}</b>${d ? `<div class="muted">${d}</div>` : ''}</div>${right || ''}</div>`;
  const SW = (id, on) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></label>`;
  m.innerHTML = `<h2>⚙️ Configurações</h2>
   <div class="muted" style="margin:6px 0">Conta</div>
   <button class="card" id="cProf" style="display:flex;gap:12px;align-items:center"><span style="font-size:24px">👤</span><div><b style="font-size:15px">Meu perfil</b><div class="muted">Telefone, endereço e contato de emergência</div></div></button>
   <div class="muted" style="margin:14px 0 6px">Aparência</div>
   ${R('cTh', cur === 'light' ? '☀️' : '🌙', 'Tema', cur === 'light' ? 'Claro' : 'Escuro', `<span class="tg" style="display:flex;background:var(--bg);border-radius:10px;padding:3px;gap:2px"><i class="t ${cur === 'light' ? 'on' : ''}" data-t="light" style="font-style:normal;padding:6px 10px;border-radius:8px">☀️</i><i class="t ${cur === 'dark' ? 'on' : ''}" data-t="dark" style="font-style:normal;padding:6px 10px;border-radius:8px">🌙</i></span>`)}
   ${R('cFt', '🔠', 'Letra maior', 'Facilita a leitura', SW('fBig', big))}
   <div class="muted" style="margin:14px 0 6px">Avisos</div>
   ${R('cSn', '🔊', 'Som dos avisos', 'Toca um som quando chega mensagem', SW('fSnd', snd))}
   ${R('cNt', '🔔', 'Avisos do celular', nOk ? 'Ativados' : 'Permitir que o AutoLink mostre avisos', nOk ? '<span class="pill">Ativos</span>' : '<button class="chip" id="fNt">Ativar</button>')}
   <div class="muted" style="margin:14px 0 6px">Privacidade</div>
   <button class="card" id="cTr" style="display:flex;gap:12px;align-items:center"><span style="font-size:24px">📄</span><b style="font-size:15px">Termos e privacidade</b></button>
   <button class="card" id="cDel" style="display:flex;gap:12px;align-items:center;border-color:#ef444455"><span style="font-size:24px">🗑️</span><div><b style="font-size:15px;color:var(--red)">Apagar minha conta</b><div class="muted">Remove seus dados, carros e documentos</div></div></button>
   <p class="muted" style="text-align:center;margin-top:20px">AutoLink · versão 1.0 beta</p>`;
  el('cProf').onclick = () => loadProfile().then(() => go(ProfileForm, {}));
  m.querySelectorAll('.t').forEach(x => x.onclick = () => { theme(x.dataset.t); go(Settings, null, false); });
  m.querySelectorAll('.t.on').forEach(x => { x.style.background = 'var(--or)'; x.style.color = '#111'; });
  el('fBig').onchange = e => { pref('font', e.target.checked ? 'big' : 'normal'); applyPrefs(); };
  el('fSnd').onchange = e => { pref('sound', e.target.checked ? 'on' : 'off'); if (e.target.checked) beep(); };
  if (el('fNt')) el('fNt').onclick = () => askNotif().then(() => go(Settings, null, false));
  el('cTr').onclick = () => location.href = 'termos.html';
  el('cDel').onclick = deleteAccount;
}
async function deleteAccount() {
  if (!confirm('Apagar sua conta AutoLink?\n\nSeus carros, documentos, registros e perfil serão apagados. Os adesivos ficam livres para serem ativados de novo com o PIN.\n\nNão dá para desfazer.')) return;
  const pw = prompt('Para confirmar, digite sua senha:'); if (!pw) return;
  const r = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: S.email, password: pw, returnSecureToken: true }) })).json();
  if (!r.idToken) return alert('Senha incorreta.');
  S.token = r.idToken; toast('Apagando...');
  try {
    const cars = await find('cars', [['ownerId', S.uid]]);
    for (const c of cars) { if (c.stickerCode) await api('/stickers/' + c.stickerCode + '?updateMask.fieldPaths=carId&updateMask.fieldPaths=ownerId&updateMask.fieldPaths=activatedAt&updateMask.fieldPaths=activationPin', 'PATCH', { fields: { carId: { nullValue: null }, ownerId: { nullValue: null }, activatedAt: { nullValue: null }, activationPin: { nullValue: null } } }).catch(() => {});
      await api('/cars/' + c.id, 'DELETE').catch(() => {}); }
    for (const col of ['maint', 'docs', 'blocked']) { const l = await find(col, [], null, '/owners/' + S.uid).catch(() => []);
      for (const x of l) { if (col === 'docs') for (let i = 0; i < +x.chunks; i++) await api('/owners/' + S.uid + '/docs/' + x.id + '/chunks/' + i, 'DELETE').catch(() => {});
        await api('/owners/' + S.uid + '/' + col + '/' + x.id, 'DELETE').catch(() => {}); } }
    await api('/profiles/' + S.uid, 'DELETE').catch(() => {});
    await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: S.token }) });
    S = null; try { localStorage.removeItem('al_owner'); } catch (e) {}
    alert('Sua conta foi apagada.'); location.reload();
  } catch (e) { alert('Erro ao apagar: ' + e.message); }
}

// ---------- Reposição de adesivo (danificado / perdido) ----------
const RREASON = { damaged: '🩹 Danificado / rasgado', faded: '🌫️ Desbotado / ilegível', lost: '❓ Perdi o adesivo', stolen: '🚨 Foi roubado / arrancado', newcar: '🚗 Troquei o vidro do carro' };
async function Replace() {
  m.innerHTML = `<h2>🔁 Danifiquei ou perdi meu QR</h2>
  <div class="card"><b>Como funciona</b><p class="muted" style="margin:6px 0 0">1. Você pede um adesivo novo aqui.<br>2. A equipe AutoLink prepara e envia para o seu endereço.<br>3. O adesivo antigo é <b>desativado</b>.<br>4. Você ativa o novo com o <b>PIN do cartão novo</b>.</p></div>
  <div class="muted" style="margin:12px 0 6px">Qual carro?</div><select id="rc" class="sel"></select>
  <div class="muted" style="margin:4px 0 6px">O que aconteceu?</div>
  <div class="types" style="grid-template-columns:1fr 1fr">${Object.entries(RREASON).map(([k, t]) => `<button data-r="${k}" style="font-size:13px;padding:12px 6px">${t}</button>`).join('')}</div>
  <div class="warn" id="rw" style="display:none;margin:0 0 10px">🛡️ Por segurança, o QR deste carro será <b>pausado agora</b>. Ninguém consegue usar o adesivo antigo. Quando o novo chegar e for ativado, o QR volta a funcionar.</div>
  <div class="card"><b style="font-size:15px">📦 Endereço de entrega</b><div class="muted" id="ra">Carregando...</div><button class="chip" id="rae" style="margin-top:8px">Alterar endereço</button></div>
  <textarea id="rn" maxlength="200" placeholder="Observação (opcional)"></textarea>
  <button class="btn" id="rs">Pedir adesivo novo</button>
  <h2>Meus pedidos</h2><div id="rl"><p class="muted">Carregando...</p></div>`;
  let reason = null;
  const cars = (await find('cars', [['ownerId', S.uid]])).filter(c => c.stickerCode);
  el('rc').innerHTML = cars.length ? cars.map(c => `<option value="${c.id}">${esc(c.name)} · ${esc(c.stickerCode)}</option>`).join('') : '<option value="">Nenhum carro com adesivo ativado</option>';
  m.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { reason = b.dataset.r; m.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); el('rw').style.display = reason === 'lost' || reason === 'stolen' ? 'block' : 'none'; });
  if (!PROFILE) await loadProfile();
  const p = PROFILE || {}, addr = [p.street, p.num, p.comp, p.district, p.city && p.city + '/' + p.uf, p.cep].filter(Boolean).join(', ');
  el('ra').textContent = addr || 'Complete seu endereço em Meu perfil';
  el('rae').onclick = () => go(ProfileForm, {});
  el('rs').onclick = async () => {
    const car = cars.find(c => c.id === el('rc').value); if (!car) return toast('Escolha o carro'); if (!reason) return toast('Diga o que aconteceu'); if (!addr) return toast('Complete seu endereço em Meu perfil');
    const b = el('rs'); b.disabled = true; b.textContent = 'Enviando...';
    try {
      if (reason === 'lost' || reason === 'stolen') await update('cars/' + car.id, { active: false });
      await add('replacements', { userId: S.uid, email: S.email || '', name: p.name || '', phone: p.phone || '', carId: car.id, carName: car.name, oldCode: car.stickerCode, reason, address: addr, note: el('rn').value.trim(), status: 'pending', createdAt: new Date() });
      alert('Pedido enviado ✅\n\nA equipe AutoLink vai preparar seu adesivo novo e enviar para o endereço informado.' + (reason === 'lost' || reason === 'stolen' ? '\n\nO QR antigo foi pausado por segurança.' : ''));
      go(Replace, null, false);
    } catch (e) { alert('Erro: ' + e.message); b.disabled = false; b.textContent = 'Pedir adesivo novo'; }
  };
  const ST = { pending: '⏳ Em preparação', sent: '📦 Enviado', done: '✅ Concluído', rejected: '❌ Cancelado' };
  try { const l = (await find('replacements', [['userId', S.uid]])).sort((a, b) => b.createdAt - a.createdAt); const box = el('rl'); if (!box) return;
    box.innerHTML = l.length ? l.map(r => `<div class="card"><b>${ST[r.status] || r.status}</b> · ${esc(r.carName)}<div class="muted">${RREASON[r.reason] || ''} · ${r.createdAt ? r.createdAt.toLocaleDateString('pt-BR') : ''}</div>${r.newCode ? `<div class="muted">Novo adesivo: <b>${esc(r.newCode)}</b>. Ative com o PIN do cartão que veio junto: Garagem → carro → Ativar adesivo.</div>` : ''}</div>`).join('') : '<p class="muted">Nenhum pedido.</p>';
  } catch (e) { const box = el('rl'); if (box) box.innerHTML = '<p class="muted">Nenhum pedido.</p>'; }
}

// ---------- Carros da família (compartilhados) ----------
async function sharedCars() {
  try { const r = await api(':runQuery', 'POST', { structuredQuery: { from: [{ collectionId: 'cars' }], where: { fieldFilter: { field: { fieldPath: 'members' }, op: 'ARRAY_CONTAINS', value: { stringValue: S.uid } } } } });
    return r.filter(x => x.document).map(x => ({ ...unpack(x.document), shared: true })); } catch (e) { return []; }
}
async function allCars() { const [own, sh] = await Promise.all([find('cars', [['ownerId', S.uid]]), sharedCars()]); return own.concat(sh); }
async function allChats(cars) {
  cars = cars || await allCars();
  const own = await find('chats', [['ownerId', S.uid]]);
  const sh = await Promise.all(cars.filter(c => c.shared).map(c => find('chats', [['carId', c.id], ['ownerId', c.ownerId]]).catch(() => [])));
  return own.concat(...sh);
}
function famCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from(crypto.getRandomValues(new Uint8Array(6)), b => A[b % A.length]).join(''); }
function familyBox(car) {
  const box = el('fam'); if (!box || car.ownerId !== S.uid) return;
  const names = car.memberNames ? String(car.memberNames).split('|').filter(Boolean) : [];
  const mem = Array.isArray(car.members) ? car.members : [];
  box.innerHTML = `<div class="card"><b>👨‍👩‍👧 Família</b><p class="muted" style="margin:4px 0 8px">Compartilhe este carro: seus familiares recebem e respondem as mensagens no celular deles.</p>
   ${mem.length ? `<div style="margin-bottom:8px">${mem.map((u, i) => `<div class="row" style="margin:4px 0"><span>👤 ${esc(names[i] || 'Familiar')}</span><button class="chip" data-rm="${i}">Remover</button></div>`).join('')}</div>` : ''}
   <button class="chip" id="fInv">+ Convidar familiar</button><div id="fCode"></div></div>`;
  el('fInv').onclick = async () => {
    const code = famCode(), exp = new Date(Date.now() + 48 * 3600e3);
    try { await api('/invites/' + code, 'PATCH', { fields: fields({ carId: car.id, ownerId: S.uid, carName: car.name, expiresAt: exp }) });
      const txt = `Te convidei para o carro "${car.name}" no AutoLink. Abra o app → Garagem → Carro da família e digite o código: ${code} (vale 48 horas). ${new URL('app.html', location.href).href}`;
      el('fCode').innerHTML = `<div style="margin-top:10px;text-align:center"><div class="muted">Código de convite (vale 48 h)</div><div class="code">${code}</div>
        <a class="btn" style="display:block;text-decoration:none;margin-top:8px;background:#25d366;color:#fff" target="_blank" href="https://wa.me/?text=${encodeURIComponent(txt)}">Enviar pelo WhatsApp</a></div>`;
    } catch (e) { alert('Erro: ' + e.message); }
  };
  box.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
    const i = +b.dataset.rm; if (!confirm('Remover ' + (names[i] || 'este familiar') + ' do carro?')) return;
    const m2 = mem.filter((_, j) => j !== i), n2 = names.filter((_, j) => j !== i);
    try { await api('/cars/' + car.id + '?updateMask.fieldPaths=members&updateMask.fieldPaths=memberNames', 'PATCH', { fields: { members: { arrayValue: { values: m2.map(u => ({ stringValue: u })) } }, memberNames: { stringValue: n2.join('|') } } });
      car.members = m2; car.memberNames = n2.join('|'); familyBox(car); toast('Familiar removido'); } catch (e) { alert(e.message); }
  });
}
async function joinFamily(code) {
  code = String(code || '').trim().toUpperCase(); if (code.length !== 6) return toast('Digite o código de 6 letras');
  try {
    let inv; try { inv = unpack(await api('/invites/' + code)); } catch (e) { return alert('Código não encontrado.'); }
    if (+inv.expiresAt < Date.now()) return alert('Este código expirou. Peça um novo ao dono do carro.');
    if (inv.ownerId === S.uid) return alert('Este carro já é seu.');
    const car = unpack(await api('/cars/' + inv.carId)); const mem = Array.isArray(car.members) ? car.members : [];
    if (mem.includes(S.uid)) return alert('Você já faz parte deste carro.');
    if (!PROFILE) await loadProfile();
    const names = car.memberNames ? String(car.memberNames).split('|') : [];
    await api('/cars/' + car.id + '?updateMask.fieldPaths=members&updateMask.fieldPaths=memberNames&updateMask.fieldPaths=joinCode', 'PATCH', { fields: {
      members: { arrayValue: { values: mem.concat([S.uid]).map(u => ({ stringValue: u })) } }, memberNames: { stringValue: names.concat([(PROFILE && PROFILE.name || S.email || 'Familiar').split(' ')[0]]).join('|') }, joinCode: { stringValue: code } } });
    alert('Pronto! ✅ Agora você recebe as mensagens do ' + inv.carName + '.'); go(Garage);
  } catch (e) { alert('Não foi possível entrar: ' + e.message); }
}

// ---------- Calendário do carro (rodízio, IPVA, licenciamento) ----------
const RODIZIO = { 1: 'Segunda-feira', 2: 'Segunda-feira', 3: 'Terça-feira', 4: 'Terça-feira', 5: 'Quarta-feira', 6: 'Quarta-feira', 7: 'Quinta-feira', 8: 'Quinta-feira', 9: 'Sexta-feira', 0: 'Sexta-feira' };
async function Calendar() {
  if (!PROFILE) await loadProfile();
  const cars = (await allCars()).filter(c => !c.shared), uf = (PROFILE && PROFILE.uf || '').toUpperCase(), city = (PROFILE && PROFILE.city || '').toLowerCase();
  m.innerHTML = `<h2>📅 Calendário do carro</h2><select id="cc" class="sel">${cars.map(c => `<option value="${c.id}">${esc(c.name)} ${c.plate ? '· ' + esc(c.plate) : ''}</option>`).join('') || '<option>Cadastre um carro</option>'}</select><div id="cal"></div>`;
  const draw = () => {
    const car = cars.find(c => c.id === el('cc').value); const box = el('cal'); if (!car) return box.innerHTML = '';
    const d = (String(car.plate || '').match(/\d(?=[^\d]*$)/) || [])[0];
    if (d === undefined) { box.innerHTML = '<div class="card">Cadastre a <b>placa</b> deste carro para ver o calendário.</div>'; return; }
    const sp = city.includes('são paulo') || city.includes('sao paulo');
    box.innerHTML = `<div class="card" style="text-align:center"><div class="muted">Final da placa</div><div class="code" style="font-size:40px">${d}</div></div>
     <div class="card"><b>🚦 Rodízio (cidade de São Paulo)</b><div style="font-size:20px;font-weight:800;color:var(--or);margin:6px 0">${RODIZIO[d]}</div>
      <div class="muted">Das 7h às 10h e das 17h às 20h, no centro expandido. ${sp ? '' : 'Só vale para quem circula na cidade de São Paulo.'}</div></div>
     <div class="card"><b>🧾 IPVA e 📄 Licenciamento ${uf ? '(' + esc(uf) + ')' : ''}</b><p class="muted" style="margin:6px 0">As datas mudam todo ano e dependem do estado e do final da placa (${d}). Confira no site da Secretaria da Fazenda e do DETRAN do seu estado e cadastre os lembretes abaixo.</p>
      <a class="chip" style="display:inline-block;text-decoration:none;margin:0 6px 8px 0" target="_blank" href="https://www.google.com/search?q=${encodeURIComponent('calendário IPVA ' + new Date().getFullYear() + ' ' + (uf || '') + ' placa final ' + d)}">🔎 Ver calendário do IPVA</a>
      <a class="chip" style="display:inline-block;text-decoration:none;margin:0 0 8px" target="_blank" href="https://www.google.com/search?q=${encodeURIComponent('calendário licenciamento ' + new Date().getFullYear() + ' DETRAN ' + (uf || '') + ' placa final ' + d)}">🔎 Ver calendário do licenciamento</a>
      <div class="muted" style="margin-top:6px">Vencimento do IPVA</div><input type="date" id="ci">
      <div class="muted">Vencimento do licenciamento</div><input type="date" id="cl">
      <button class="btn" id="cs">Criar lembretes</button></div>`;
    el('cs').onclick = async () => {
      const L = [['IPVA', el('ci').value], ['Licenciamento', el('cl').value]].filter(x => x[1]); if (!L.length) return toast('Preencha pelo menos uma data');
      try { for (const [k, v] of L) await add('owners/' + S.uid + '/maint', { carId: car.id, kind: k, note: 'Vencimento (calendário)', remind: new Date(v + 'T09:00:00'), createdAt: new Date() });
        toast('Lembretes criados ✅ Aparecem na tela inicial 15 dias antes.'); } catch (e) { alert('Erro: ' + e.message); }
    };
  };
  el('cc').onchange = draw; draw();
}

// ---------- Mercado (busca, filtros e compatibilidade) ----------
const MCATS = [['🔩', 'Peças'], ['🚗', 'Compra e venda'], ['🛡️', 'Seguros'], ['🔑', 'Aluguel de carros'], ['🔧', 'Oficinas'], ['🧽', 'Lava-jatos'], ['🚛', 'Guincho 24h'], ['🎧', 'Acessórios'], ['📡', 'Rastreador GPS'], ['⛽', 'Postos'], ['⚡', 'Postos elétricos'], ['🅿️', 'Estacionamentos'], ['🤝', 'Parceiros'], ['📋', 'Despachante'], ['🔍', 'Perito automotivo'], ['🎨', 'Funilaria e pintura'], ['🔊', 'Som e película'], ['✅', 'Vistoria']];
async function Market() {
  const cars = await allCars().catch(() => []);
  const label = c => [c.brand, c.model, c.year].filter(Boolean).join(' ') || c.name;
  m.innerHTML = `<h2>🛒 Mercado</h2>
   <div style="position:relative"><input id="mq" placeholder="Buscar peças, serviços, lojas..." style="padding-left:42px"><span style="position:absolute;left:14px;top:13px;font-size:18px">🔎</span></div>
   <div class="card" style="display:flex;gap:10px;align-items:center;padding:10px 12px"><span style="font-size:22px">🚗</span><div style="flex:1;min-width:0"><div class="muted">Compatível com</div>
    <select id="mcar" class="sel" style="margin:4px 0 0;padding:8px 10px"><option value="">Todos os carros</option>${cars.map(c => `<option value="${c.id}">${esc(label(c))}</option>`).join('')}</select></div></div>
   ${cars.some(c => !c.brand) ? '<p class="muted" style="margin:-4px 0 10px">💡 Informe marca, modelo e ano do carro para ver só peças compatíveis.</p>' : ''}
   <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:6px" id="mf">${['📍 Mais perto', '💲 Menor preço', '⭐ Melhor avaliados', '✔️ Verificados', '🚚 Entrega', '🕐 Aberto agora'].map(f => `<button class="chip" style="white-space:nowrap">${f}</button>`).join('')}</div>
   <h2 style="margin-top:12px">Categorias</h2><div class="grid">${MCATS.map(([e, l]) => `<button class="sc" data-c="${l}"><span class="ic" style="font-size:28px">${e}</span>${l}</button>`).join('')}</div>
   <div class="warn" style="text-align:center">🚧 O Mercado está em construção. Busca, filtros e compatibilidade já estão prontos para quando as lojas entrarem.</div>`;
  const carTxt = () => { const c = cars.find(x => x.id === el('mcar').value); return c ? ' compatível com ' + label(c) : ''; };
  el('mq').onkeydown = e => { if (e.key === 'Enter' && el('mq').value.trim()) toast(`🚧 Busca por "${el('mq').value.trim()}"${carTxt()}: em breve!`); };
  el('mf').querySelectorAll('.chip').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.style.background = b.classList.contains('on') ? 'var(--or)' : ''; b.style.color = b.classList.contains('on') ? '#111' : ''; });
  m.querySelectorAll('.sc[data-c]').forEach(b => b.onclick = () => b.dataset.c === 'Lava-jatos' ? go(Category, 'Lava-jatos') : toast('🚧 ' + b.dataset.c + carTxt() + ': em construção. Em breve!'));
}
function Category(name) {
  m.innerHTML = `<h2>🧽 ${esc(name)}</h2><p class="muted">Lava-jatos parceiros perto de você: lavagem simples, completa, higienização, polimento e enceramento.</p>
   <div style="display:flex;gap:6px;overflow-x:auto;margin-bottom:10px">${['📍 Mais perto', '💲 Menor preço', '⭐ Melhor avaliados', '🏠 Busca em casa'].map(f => `<button class="chip" style="white-space:nowrap">${f}</button>`).join('')}</div>
   <div class="card" style="text-align:center;padding:24px"><div style="font-size:40px">🧽</div><b>Ainda não há lava-jatos parceiros na sua região</b><p class="muted">Estamos cadastrando os primeiros parceiros.</p></div>
   <button class="btn" id="lj">Tenho um lava-jato: quero participar</button>
   <button class="link" id="li">Indicar um lava-jato que eu conheço</button>`;
  el('lj').onclick = () => go(Advertise, 'sell');
  el('li').onclick = () => go(Advertise, 'ad');
}
