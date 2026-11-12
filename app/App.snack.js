// Versão em arquivo único para colar no snack.expo.dev (sem a biblioteca do Firebase: usa a API web direto)
import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, Alert, Switch } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'AIzaSyBSGj1H273wiXM-VgpkytnC3kX6yQlt8_I';
const BASE = 'https://firestore.googleapis.com/v1/projects/autolink-1aa51/databases/(default)/documents';
const WEB_URL = 'https://advfilipeaugusto.github.io/AutoLink/web/';

// ---------- Login anônimo ----------
let session = null; // { uid, token, refresh, exp }
async function login() {
  const saved = await AsyncStorage.getItem('session');
  let r;
  if (saved) {
    const s = JSON.parse(saved);
    r = await (await fetch('https://securetoken.googleapis.com/v1/token?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + s.refresh })).json();
    if (r.id_token) session = { uid: r.user_id, token: r.id_token, refresh: r.refresh_token };
  }
  if (!session) {
    r = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' })).json();
    if (!r.idToken) throw new Error(JSON.stringify(r.error || r));
    session = { uid: r.localId, token: r.idToken, refresh: r.refreshToken };
  }
  session.exp = Date.now() + 50 * 60 * 1000;
  await AsyncStorage.setItem('session', JSON.stringify(session));
  return session.uid;
}

// ---------- Banco de dados ----------
const enc = v => typeof v === 'boolean' ? { booleanValue: v } : v instanceof Date ? { timestampValue: v.toISOString() } : { stringValue: String(v) };
const dec = f => 'booleanValue' in f ? f.booleanValue : 'timestampValue' in f ? new Date(f.timestampValue) : f.stringValue;
const fields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
const unpack = d => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])) });
async function api(path, method = 'GET', body) {
  if (Date.now() > session.exp) { session = null; await login(); }
  const r = await fetch(BASE + path, { method, headers: { Authorization: 'Bearer ' + session.token, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j.error || j)); return j;
}
const add = async (col, data) => unpack(await api('/' + col, 'POST', { fields: fields(data) }));
const update = (path, data) => api('/' + path + '?' + Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&'), 'PATCH', { fields: fields(data) });
async function find(col, filters, order, parent = '') {
  const where = { compositeFilter: { op: 'AND', filters: filters.map(([f, v]) => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: enc(v) } })) } };
  const q = { from: [{ collectionId: col }], ...(filters.length && { where }), ...(order && { orderBy: [{ field: { fieldPath: order }, direction: 'ASCENDING' }] }) };
  const res = await api(parent + ':runQuery', 'POST', { structuredQuery: q });
  return res.filter(x => x.document).map(x => unpack(x.document));
}
// Atualiza a tela a cada 3 segundos
function usePoll(fn, deps) {
  useEffect(() => { let on = true; const run = () => fn().then(v => on && v).catch(() => {}); run(); const t = setInterval(run, 3000); return () => { on = false; clearInterval(t); }; }, deps);
}

export default function App() {
  const [uid, setUid] = useState(null); const [err, setErr] = useState(null);
  const [screen, setScreen] = useState({ name: 'home' });
  useEffect(() => { login().then(setUid).catch(e => setErr(e.message)); }, []);
  if (err) return <Center><Text style={{ padding: 20 }}>Erro ao entrar: {err}</Text></Center>;
  if (!uid) return <Center><Text>Carregando...</Text></Center>;
  const go = (name, p = {}) => setScreen({ name, ...p });
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        {screen.name !== 'home' && <TouchableOpacity onPress={() => go(screen.name === 'chat' ? 'car' : 'home', { car: screen.car })}><Text style={s.back}>‹ Voltar</Text></TouchableOpacity>}
        <Text style={s.title}>Auto Link</Text>
      </View>
      {screen.name === 'home' && <Home uid={uid} go={go} />}
      {screen.name === 'car' && <Car car={screen.car} go={go} />}
      {screen.name === 'chat' && <Chat car={screen.car} chatId={screen.chatId} />}
    </SafeAreaView>
  );
}

function Home({ uid, go }) {
  const [cars, setCars] = useState([]);
  const [name, setName] = useState(''); const [plate, setPlate] = useState('');
  usePoll(async () => setCars(await find('cars', [['ownerId', uid]])), [uid]);
  const create = async () => {
    if (!name) return Alert.alert('Dê um nome ao carro');
    try { const c = await add('cars', { ownerId: uid, name, plate: plate.toUpperCase(), active: true, createdAt: new Date() }); setCars(x => [...x, c]); setName(''); setPlate(''); }
    catch (e) { Alert.alert('Erro', e.message); }
  };
  return (
    <View style={s.pad}>
      <Text style={s.h2}>Meus carros</Text>
      <FlatList data={cars} keyExtractor={c => c.id} renderItem={({ item }) => (
        <TouchableOpacity style={s.card} onPress={() => go('car', { car: item })}>
          <Text style={s.cardT}>{item.name}</Text><Text style={s.muted}>{item.plate} {item.active ? '' : '· pausado'}</Text>
        </TouchableOpacity>)} ListEmptyComponent={<Text style={s.muted}>Nenhum carro ainda.</Text>} />
      <Text style={s.h2}>Adicionar carro</Text>
      <TextInput style={s.input} placeholder="Nome (ex: Onix prata)" value={name} onChangeText={setName} />
      <TextInput style={s.input} placeholder="Placa (opcional)" value={plate} onChangeText={setPlate} />
      <Btn label="Adicionar" onPress={create} />
    </View>
  );
}

function Car({ car, go }) {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(car.active);
  const url = `${WEB_URL}?c=${car.id}`;
  usePoll(async () => setChats((await find('chats', [['carId', car.id], ['ownerId', car.ownerId]])).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))), [car.id]);
  const toggle = async v => { setActive(v); car.active = v; await update('cars/' + car.id, { active: v }); };
  return (
    <View style={s.pad}>
      <Text style={s.h2}>{car.name}</Text>
      <View style={s.qr}><QRCode value={url} size={200} /></View>
      <Text style={[s.muted, { textAlign: 'center' }]}>Tire print desta tela e imprima o QR para colar no carro.</Text>
      <View style={s.row}><Text>QR ativo</Text><Switch value={active} onValueChange={toggle} /></View>
      <Text style={s.h2}>Conversas</Text>
      <FlatList data={chats} keyExtractor={c => c.id} renderItem={({ item }) => (
        <TouchableOpacity style={s.card} onPress={() => go('chat', { car, chatId: item.id })}>
          <Text numberOfLines={1}>{item.lastMsg}</Text>
          <Text style={s.muted}>{item.updatedAt?.toLocaleString?.('pt-BR')}</Text>
        </TouchableOpacity>)} ListEmptyComponent={<Text style={s.muted}>Nenhuma mensagem ainda.</Text>} />
    </View>
  );
}

function Chat({ car, chatId }) {
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const list = useRef();
  usePoll(async () => setMsgs(await find('messages', [], 'at', '/chats/' + chatId)), [chatId]);
  const send = async () => {
    if (!text.trim()) return;
    const t = text.trim(); setText('');
    try {
      const m = await add('chats/' + chatId + '/messages', { text: t, from: 'owner', at: new Date() }); setMsgs(x => [...x, m]);
      await update('chats/' + chatId, { lastMsg: 'Você: ' + t, updatedAt: new Date() });
    } catch (e) { Alert.alert('Erro', e.message); }
  };
  const quick = ['Já estou indo!', 'Me dá 5 minutos', 'Obrigado pelo aviso!'];
  return (
    <View style={[s.pad, { flex: 1 }]}>
      <Text style={s.h2}>{car.name}</Text>
      <FlatList ref={list} data={msgs} keyExtractor={m => m.id} onContentSizeChange={() => list.current?.scrollToEnd()}
        renderItem={({ item }) => <View style={[s.bubble, item.from === 'owner' ? s.me : s.them]}>
          <Text style={item.from === 'owner' && { color: '#fff' }}>{item.text}</Text></View>} />
      <View style={s.row}>{quick.map(q => <TouchableOpacity key={q} style={s.chip} onPress={() => setText(q)}><Text>{q}</Text></TouchableOpacity>)}</View>
      <View style={s.row}><TextInput style={[s.input, { flex: 1 }]} value={text} onChangeText={setText} placeholder="Responder..." /><Btn label="Enviar" onPress={send} /></View>
    </View>
  );
}

const Btn = ({ label, onPress }) => <TouchableOpacity style={s.btn} onPress={onPress}><Text style={s.btnT}>{label}</Text></TouchableOpacity>;
const Center = ({ children }) => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f8', paddingTop: 30 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#0b5cff', gap: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' }, back: { color: '#fff', fontSize: 16 },
  pad: { padding: 16, flex: 1 }, h2: { fontSize: 18, fontWeight: '700', marginVertical: 10 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 8 }, cardT: { fontSize: 16, fontWeight: '600' },
  muted: { color: '#777', fontSize: 13 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ddd' },
  btn: { backgroundColor: '#0b5cff', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 }, btnT: { color: '#fff', fontWeight: '700' },
  qr: { alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginVertical: 6 },
  bubble: { padding: 10, borderRadius: 12, marginVertical: 3, maxWidth: '80%' },
  me: { backgroundColor: '#0b5cff', alignSelf: 'flex-end' }, them: { backgroundColor: '#fff', alignSelf: 'flex-start' },
  chip: { backgroundColor: '#e6ecff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
});
