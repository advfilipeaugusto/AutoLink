// Versão em arquivo único para colar no snack.expo.dev
import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, Alert, Switch, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyBSGj1H273wiXM-VgpkytnC3kX6yQlt8_I",
  authDomain: "autolink-1aa51.firebaseapp.com",
  projectId: "autolink-1aa51",
  storageBucket: "autolink-1aa51.firebasestorage.app",
  messagingSenderId: "1041471435882",
  appId: "1:1041471435882:web:ab5368455a0f80d41e4613",
};
// Endereço da página que abre ao escanear o QR (GitHub Pages)
const WEB_URL = "https://advfilipeaugusto.github.io/AutoLink/web/";

const fb = initializeApp(firebaseConfig);
let auth; try { auth = initializeAuth(fb, { persistence: getReactNativePersistence(AsyncStorage) }); } catch (e) { auth = getAuth(fb); }
const db = getFirestore(fb);

async function registerPush() {} // notificações desativadas na versão de teste do Snack

export default function App() {
  const [uid, setUid] = useState(null);
  const [screen, setScreen] = useState({ name: 'home' });
  useEffect(() => onAuthStateChanged(auth, u => {
    if (u) { setUid(u.uid); registerPush(u.uid).catch(() => {}); } else signInAnonymously(auth);
  }), []);
  if (!uid) return <Center><Text>Carregando...</Text></Center>;
  const go = (name, p = {}) => setScreen({ name, ...p });
  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        {screen.name !== 'home' && <TouchableOpacity onPress={() => go('home')}><Text style={s.back}>‹ Voltar</Text></TouchableOpacity>}
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
  useEffect(() => onSnapshot(query(collection(db, 'cars'), where('ownerId', '==', uid)),
    snap => setCars(snap.docs.map(d => ({ id: d.id, ...d.data() })))), [uid]);
  const add = async () => {
    if (!name) return Alert.alert('Dê um nome ao carro');
    await addDoc(collection(db, 'cars'), { ownerId: uid, name, plate: plate.toUpperCase(), active: true, createdAt: serverTimestamp() });
    setName(''); setPlate('');
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
      <Btn label="Adicionar" onPress={add} />
    </View>
  );
}

function Car({ car, go }) {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(car.active);
  const url = `${WEB_URL}?c=${car.id}`;
  useEffect(() => onSnapshot(query(collection(db, 'chats'), where('carId', '==', car.id), where('ownerId', '==', car.ownerId)),
    snap => setChats(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)))), [car.id]);
  const toggle = async v => { setActive(v); await updateDoc(doc(db, 'cars', car.id), { active: v }); };
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
          <Text style={s.muted}>{item.updatedAt?.toDate?.().toLocaleString('pt-BR')}</Text>
        </TouchableOpacity>)} ListEmptyComponent={<Text style={s.muted}>Nenhuma mensagem ainda.</Text>} />
    </View>
  );
}

function Chat({ car, chatId }) {
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(''); const list = useRef();
  useEffect(() => onSnapshot(query(collection(db, 'chats', chatId, 'messages'), orderBy('at')),
    snap => setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })))), [chatId]);
  const send = async () => {
    if (!text.trim()) return;
    const t = text.trim(); setText('');
    await addDoc(collection(db, 'chats', chatId, 'messages'), { text: t, from: 'owner', at: serverTimestamp() });
    await updateDoc(doc(db, 'chats', chatId), { lastMsg: 'Você: ' + t, updatedAt: serverTimestamp() });
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
