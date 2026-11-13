// AutoLink · filtro de mensagens (o mesmo bloqueio também existe nas regras do Firebase)
const CHAT_MIN = 20; // quem escaneou pode escrever por 20 minutos a partir da primeira mensagem
const AL_BAD = [
  // assédio / conteúdo sexual
  'gostos', 'delicia', 'tesao', 'tesuda', 'safad', 'pelad', 'nude', 'manda foto', 'manda uma foto', 'sexo', 'transar', 'gatinha', 'linda demais', 'bunda', 'peito', 'rabuda',
  // pedir contato
  'seu numero', 'teu numero', 'seu telefone', 'seu zap', 'seu whats', 'teu zap', 'teu whats', 'me passa seu', 'me passa o seu', 'me da seu', 'seu insta', 'seu instagram', 'me chama no',
  // xingamentos
  'puta', 'puto', 'porra', 'caralho', 'buceta', 'boceta', 'foder', 'fode', 'fodid', 'vadia', 'vagabund', 'piranha', 'arrombad', 'viado', 'corno', 'otari', 'idiota', 'imbecil', 'babaca',
  'merda', 'desgraca', 'fdp', 'filho da puta', 'cuzao', 'retardad', 'escrot', 'lixo humano', 'vai se ferrar', 'vai tomar no', 'vtnc', 'pqp',
  // ameaças
  'vou te matar', 'te matar', 'vou te pegar', 'vou quebrar', 'vou riscar', 'vou furar', 'sei onde voce mora', 'vai se arrepender'];
function alNorm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[0@]/g, m => m === '0' ? 'o' : 'a').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/\s+/g, ' '); }
// Retorna o motivo do bloqueio, ou null se a mensagem pode ser enviada
function alCheck(text, allowContact) {
  const raw = String(text || ''), n = alNorm(raw);
  if (!allowContact) {
  const seq = raw.match(/\d[\d\s.\-()]{6,}\d/g) || []; if (seq.some(x => x.replace(/\D/g, '').length >= 8)) return 'telefone';
  if (/[\w.+-]+@[\w-]+\.\w+/.test(raw) || /(https?:\/\/|www\.|\.com\b|\.br\b|instagram|\binsta\b|tiktok|facebook|\bface\b)/i.test(raw)) return 'contato';
  }
  const t = ' ' + n.replace(/[^a-z ]/g, ' ') + ' '; for (const w of AL_BAD) if (t.includes(' ' + w)) return 'palavra';
  return null;
}
function alBlockedMsg(reason) {
  return reason === 'telefone' || reason === 'contato'
    ? '🚫 Mensagem bloqueada.\n\nPor segurança, não é permitido enviar telefone, e-mail, redes sociais ou links pelo AutoLink.'
    : '🚫 Mensagem bloqueada.\n\nSua mensagem tem palavras não permitidas. Use outras palavras e seja respeitoso.';
}
const REPLY_H = 2; // depois que o dono responde, a conversa fica aberta por 2 horas
function alStart(chat) { return chat && (chat.createdAt || chat.updatedAt); }
function alEnd(chat) { const t = alStart(chat); if (!t) return Date.now() + CHAT_MIN * 60e3; return Math.max(+t + CHAT_MIN * 60e3, chat.repliedAt ? +chat.repliedAt + REPLY_H * 3600e3 : 0); }
function alChatOpen(chat) { return Date.now() < alEnd(chat); }
function alLeft(chat) { return Math.max(0, Math.ceil((alEnd(chat) - Date.now()) / 60e3)); }
function alLeftTxt(chat) { const m = alLeft(chat); return m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
