// Onde os dados ficam guardados.
// Com o Firebase configurado (js/firebase-config.js), todo mundo que abre o link vê os mesmos dados,
// ao vivo, e quem entra com uma conta Google da equipe edita. Sem ele, o app funciona só neste
// aparelho (localStorage), sem login, o que serve para testar.

export const COLECOES = ['config', 'modalidades', 'jogos', 'resultados', 'penalidades'];
const EDICAO = '2026';
const VERSAO_FIREBASE = '10.12.2';
const LIMITE_LOTE = 400; // o Firestore aceita até 500 operações por lote

export function estadoVazio() {
  return Object.fromEntries(COLECOES.map((c) => [c, {}]));
}

// O Firestore recusa campos undefined; a ida e volta por JSON remove todos de uma vez.
function limpar(dados) {
  return JSON.parse(JSON.stringify(dados));
}

export async function criarArmazenamento(config) {
  return config?.projectId ? criarFirebase(config) : criarLocal();
}

function criarLocal() {
  const CHAVE = 'placar-interpuc-2026';
  const ler = () => {
    try {
      return { ...estadoVazio(), ...JSON.parse(localStorage.getItem(CHAVE) || '{}') };
    } catch {
      return estadoVazio();
    }
  };
  let estado = ler();
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach((fn) => fn(estado));
  const gravar = () => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (erro) {
      console.error('Não foi possível gravar no aparelho', erro);
    }
    avisar();
  };
  window.addEventListener('storage', (e) => {
    if (e.key !== CHAVE) return;
    estado = ler();
    avisar();
  });
  return {
    modo: 'local',
    conta: null,
    equipe: null,
    analises: {
      ouvir(fn) {
        const enviar = (e) => fn(e.analises || {});
        ouvintes.add(enviar);
        enviar(estado);
        return () => ouvintes.delete(enviar);
      },
    },
    ouvir(fn) {
      ouvintes.add(fn);
      fn(estado);
    },
    aoFalhar() {},
    async salvar(col, id, dados) {
      estado = { ...estado, [col]: { ...estado[col], [id]: limpar(dados) } };
      gravar();
    },
    async apagar(col, id) {
      const resto = { ...estado[col] };
      delete resto[id];
      estado = { ...estado, [col]: resto };
      gravar();
    },
    async substituirTudo(novo) {
      estado = { ...estadoVazio(), ...limpar(novo) };
      gravar();
    },
  };
}

async function criarFirebase(config) {
  const base = `https://www.gstatic.com/firebasejs/${VERSAO_FIREBASE}`;
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  const appFirebase = initializeApp(config);
  // Com o Auth no mesmo app, o Firestore manda o login junto com cada gravação.
  const autenticacao = au.getAuth(appFirebase);
  let db;
  try {
    // Guarda uma cópia no aparelho: o app abre e aceita lançamentos mesmo com sinal ruim na quadra.
    db = fs.initializeFirestore(appFirebase, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(appFirebase);
  }
  const colecao = (col) => fs.collection(db, 'edicoes', EDICAO, col);
  const documento = (col, id) => fs.doc(db, 'edicoes', EDICAO, col, id);

  let estado = estadoVazio();
  const carregadas = new Set();
  const ouvintes = new Set();
  const falhas = new Set();
  const avisar = () => {
    if (carregadas.size === COLECOES.length) ouvintes.forEach((fn) => fn(estado));
  };
  for (const col of COLECOES) {
    fs.onSnapshot(
      colecao(col),
      (snap) => {
        const docs = {};
        snap.forEach((d) => {
          docs[d.id] = d.data();
        });
        estado = { ...estado, [col]: docs };
        carregadas.add(col);
        avisar();
      },
      (erro) => falhas.forEach((fn) => fn(erro)),
    );
  }

  const docEquipe = fs.doc(db, 'edicoes', EDICAO, 'acesso', 'equipe');

  return {
    modo: 'compartilhado',
    conta: {
      ouvir: (fn) =>
        au.onAuthStateChanged(autenticacao, (u) => fn(u ? { uid: u.uid, email: u.email || '', nome: u.displayName || '' } : null)),
      entrar() {
        const provedor = new au.GoogleAuthProvider();
        provedor.setCustomParameters({ prompt: 'select_account' }); // deixa escolher a conta no celular com várias
        return au.signInWithPopup(autenticacao, provedor);
      },
      sair: () => au.signOut(autenticacao),
    },
    // Lista de quem edita. Só a própria equipe consegue ler; para os outros o banco responde "sem permissão".
    equipe: {
      ouvir: (fn, falha) => fs.onSnapshot(docEquipe, (snap) => fn(snap.exists() ? snap.data() : { admins: [], editores: [] }), falha),
      salvar: (dados) => fs.setDoc(docEquipe, limpar(dados)),
    },
    // Análises da equipe (relatórios e destaques de atletas): como a lista acima, só a equipe lê.
    analises: {
      ouvir: (fn, falha) =>
        fs.onSnapshot(
          colecao('analises'),
          (snap) => {
            const docs = {};
            snap.forEach((d) => {
              docs[d.id] = d.data();
            });
            fn(docs);
          },
          falha,
        ),
    },
    ouvir(fn) {
      ouvintes.add(fn);
      if (carregadas.size === COLECOES.length) fn(estado);
    },
    aoFalhar(fn) {
      falhas.add(fn);
    },
    salvar: (col, id, dados) => fs.setDoc(documento(col, id), limpar(dados)),
    apagar: (col, id) => fs.deleteDoc(documento(col, id)),
    async substituirTudo(novo) {
      const operacoes = [];
      for (const col of COLECOES) {
        const novos = novo[col] || {};
        for (const id of Object.keys(estado[col])) if (!(id in novos)) operacoes.push((lote) => lote.delete(documento(col, id)));
        for (const [id, dados] of Object.entries(novos)) operacoes.push((lote) => lote.set(documento(col, id), limpar(dados)));
      }
      for (let i = 0; i < operacoes.length; i += LIMITE_LOTE) {
        const lote = fs.writeBatch(db);
        operacoes.slice(i, i + LIMITE_LOTE).forEach((op) => op(lote));
        await lote.commit();
      }
    },
  };
}
