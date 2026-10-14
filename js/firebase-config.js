// Configuração do Firebase, o banco que deixa os dados compartilhados entre todos os diretores.
// Projeto "placar-interpuc" (Firestore em São Paulo). Estes dados não são secretos: o Firebase foi feito
// para que eles fiquem no site. Quem protege o banco são as regras em firestore.rules.
// Com null aqui, o app funciona em modo local: os dados ficam só no aparelho de quem usa.
export const firebaseConfig = {
  apiKey: 'AIzaSyD_UBDpvtW9g_gGtd_b55JbV8gSCnXKYAE',
  authDomain: 'placar-interpuc.firebaseapp.com',
  projectId: 'placar-interpuc',
  storageBucket: 'placar-interpuc.firebasestorage.app',
  messagingSenderId: '820093002994',
  appId: '1:820093002994:web:4711d2e26965fb79371c6b',
};

// Dono do placar: SHA-256 do e-mail (o mesmo valor está em firestore.rules). O dono é sempre
// administrador, mesmo que alguém o tire da lista da equipe. O e-mail em si não fica no código.
export const donoHash = 'a3445ce9f68e515d8afc2a389b4ffe4210b25481a31c2f9862375c2b152718d4';
