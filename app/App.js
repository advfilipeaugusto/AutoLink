import { useEffect, useState, useRef } from 'react';
import { Linking, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, Alert, Switch, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SvgXml } from 'react-native-svg';
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#FF6B00"/><path d="M92 112h328a40 40 0 0 1 40 40v184a40 40 0 0 1-40 40H232l-86 72v-72H92a40 40 0 0 1-40-40V152a40 40 0 0 1 40-40z" fill="#111"/><path d="M96 300v-26c0-14 8-24 22-27l52-10 44-38c10-8 22-12 35-12h70c16 0 30 6 41 17l34 33 22 4c14 3 24 14 24 28v31z" fill="#FF6B00"/><path d="M206 244l30-26c6-5 13-7 21-7h22v33z M295 244v-33h22c9 0 17 3 23 9l25 24z" fill="#111"/><rect x="352" y="262" width="22" height="9" rx="4" fill="#111"/><circle cx="164" cy="304" r="30" fill="#111"/><circle cx="164" cy="304" r="16" fill="#FF6B00"/><circle cx="350" cy="304" r="30" fill="#111"/><circle cx="350" cy="304" r="16" fill="#FF6B00"/><g transform="translate(364 132)" fill="#FF6B00"><path d="M0 0h26v26H0zM8 8v10h10V8z" fill-rule="evenodd"/><path d="M38 0h26v26H38zM46 8v10h10V8z" fill-rule="evenodd"/><path d="M0 38h26v26H0zM8 46v10h10V46z" fill-rule="evenodd"/><rect x="38" y="38" width="10" height="10"/><rect x="54" y="38" width="10" height="10"/><rect x="46" y="54" width="10" height="10"/></g></svg>`;
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig, WEB_URL } from './firebaseConfig';

const fb = initializeApp(firebaseConfig);
const auth = initializeAuth(fb, { persistence: getReactNativePersistence(AsyncStorage) });
const db = getFirestore(fb);
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });

async function registerPush(uid) {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: 5 });
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await setDoc(doc(db, 'owners', uid), { pushToken: token }, { merge: true });
}

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
        <SvgXml xml={LOGO} width={36} height={36} />
        <Text style={s.title}>Auto<Text style={{ color: '#FF6B00' }}>Link</Text></Text>
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
      <View style={s.qr}><QRCode value={url} size={200} color="#111" /></View>
      <Btn label="Ver adesivo para imprimir" onPress={() => Linking.openURL(`${WEB_URL}adesivo.html?c=${car.id}`)} />
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
          <Text style={{ color: item.from === 'owner' ? '#111' : '#fff' }}>{item.text}</Text></View>} />
      <View style={s.row}>{quick.map(q => <TouchableOpacity key={q} style={s.chip} onPress={() => setText(q)}><Text>{q}</Text></TouchableOpacity>)}</View>
      <View style={s.row}><TextInput style={[s.input, { flex: 1 }]} value={text} onChangeText={setText} placeholder="Responder..." /><Btn label="Enviar" onPress={send} /></View>
    </View>
  );
}

const Btn = ({ label, onPress }) => <TouchableOpacity style={s.btn} onPress={onPress}><Text style={s.btnT}>{label}</Text></TouchableOpacity>;
const Center = ({ children }) => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 30 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#111', gap: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' }, back: { color: '#FF6B00', fontSize: 16, fontWeight: '700' },
  pad: { padding: 16, flex: 1 }, h2: { fontSize: 18, fontWeight: '700', marginVertical: 10 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, borderLeftWidth: 5, borderLeftColor: '#FF6B00' }, cardT: { fontSize: 16, fontWeight: '600' },
  muted: { color: '#777', fontSize: 13 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ddd' },
  btn: { backgroundColor: '#FF6B00', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 }, btnT: { color: '#111', fontWeight: '800' },
  qr: { alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginVertical: 6 },
  bubble: { padding: 10, borderRadius: 12, marginVertical: 3, maxWidth: '80%' },
  me: { backgroundColor: '#FF6B00', alignSelf: 'flex-end' }, them: { backgroundColor: '#111', alignSelf: 'flex-start' },
  chip: { backgroundColor: '#FFE1CC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
});
