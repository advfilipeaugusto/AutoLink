// Envia notificação ao dono quando chega mensagem de um visitante
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin'); admin.initializeApp();
exports.notifyOwner = onDocumentCreated('chats/{chatId}/messages/{msgId}', async (e) => {
  const msg = e.data.data(); if (msg.from !== 'visitor') return;
  const chat = (await admin.firestore().doc(`chats/${e.params.chatId}`).get()).data();
  const owner = (await admin.firestore().doc(`owners/${chat.ownerId}`).get()).data();
  if (!owner?.pushToken) return;
  await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: owner.pushToken, title: 'Auto Link: mensagem sobre seu carro', body: msg.text, sound: 'default' }) });
});
