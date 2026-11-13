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
      const chats = await find('chats', [['ownerId', S.uid]]);
      const fresh = chats.filter(c => c.updatedAt && +c.updatedAt > since && !String(c.lastMsg || '').startsWith('Você:') && !c.blocked);
      if (fresh.length) {
        since = Date.now(); const t = fresh[0].lastMsg || 'Nova mensagem sobre seu carro';
        toast('🔔 ' + t); if (navigator.vibrate) navigator.vibrate([250, 120, 250]); beep();
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
    if (act) html += `<div class="card" style="border-color:var(--or)">🟠 <b>Ausência ativa</b> até ${act.awayUntil.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<div class="muted">"${esc(act.awayText)}"</div></div>`;
    else if (exp) html += `<div class="card" style="border-color:var(--or)">⏰ <b>Sua mensagem de ausência terminou.</b><div class="muted">"${esc(exp.awayText)}"</div><div style="display:flex;gap:8px;margin-top:8px"><button class="chip" id="awr">Renovar</button><button class="chip" id="awx">Dispensar</button></div></div>`;
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
  <div class="card"><b>Novo registro</b>
   <select id="mc" class="sel"></select><select id="mk" class="sel">${MKINDS.map(k => `<option>${k}</option>`).join('')}</select>
   <div style="display:flex;gap:8px"><input id="md" type="date" title="Data"><input id="mkm" inputmode="numeric" placeholder="Km"></div>
   <input id="mv" inputmode="decimal" placeholder="Valor (R$)">
   <input id="mn" placeholder="Observação (ex: oficina, peça)" maxlength="150">
   <div class="muted" style="margin:2px 0 4px">⏰ Lembrar em (opcional)</div><input id="mr" type="date">
   <button class="btn" id="ms">Salvar</button></div>
  <h2>Histórico</h2><div id="ml"><p class="muted">Carregando...</p></div>`;
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
   <svg viewBox="0 0 400 170" style="display:block;width:100%;height:auto">
    <rect width="400" height="170" fill="var(--card2)"/>
    <g stroke="var(--line)" stroke-width="10" fill="none"><path d="M-10 60 L410 40"/><path d="M-10 130 L410 120"/><path d="M90 -10 L120 180"/><path d="M260 -10 L300 180"/></g>
    <g stroke="var(--line)" stroke-width="4" fill="none" opacity=".7"><path d="M-10 95 L410 82"/><path d="M180 -10 L200 180"/><path d="M340 -10 L360 180"/><path d="M30 -10 L50 180"/></g>
    <path d="M300 10 q30 20 60 10 q20 -5 40 5 v-25 h-100z" fill="#3b82f633"/>
    <circle cx="200" cy="88" r="46" fill="#FF6B0018" stroke="#FF6B0066" stroke-dasharray="4 4"/>
    <circle cx="200" cy="88" r="8" fill="#FF6B00"/><circle cx="200" cy="88" r="14" fill="none" stroke="#FF6B00" stroke-width="2" opacity=".6"/>
   </svg>
   <div style="padding:12px 16px;display:flex;align-items:center;gap:10px"><span style="font-size:22px">${n ? '⚠️' : '✅'}</span><div><b style="font-size:15px">${n ? n + ' alerta(s) na sua região' : 'Zero alertas na sua região'}</b>
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
