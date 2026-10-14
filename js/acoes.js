// O que cada botão, seletor e formulário das telas faz (ligados por data-acao, data-mudar e data-form).
// Ações que mudam dados conferem a permissão antes; o banco confere de novo no servidor.

import { ATLETICAS } from './dados.js';
import { app, aviso, gravar, salvarPreferencias } from './contexto.js';
import {
  folhaApagarTudo,
  folhaClassificacao,
  folhaGrupos,
  folhaJogo,
  folhaProva,
  folhaPunicao,
  folhaRemarcar,
  folhaRestaurar,
} from './folhas.js';
import { normalizarEmail } from './permissoes.js';
import { hojeISO } from './util.js';

// Só para quem pode editar (ou administrar). Quem não pode recebe um aviso em vez da ação.
const soEditor =
  (acao) =>
  (...args) => {
    if (app.pode.editar) return acao(...args);
    aviso(app.usuario ? 'Sua conta não está na equipe. Peça a um administrador para incluí-la.' : 'Entre com uma conta da equipe para editar (Ajustes → Conta).', 'erro');
  };
const soAdmin =
  (acao) =>
  (...args) => {
    if (app.pode.administrar) return acao(...args);
    aviso('Só administradores podem fazer isso.', 'erro');
  };

function salvarConfig(parcial, texto = 'Ajuste salvo') {
  gravar(app.loja.salvar('config', 'geral', { ...(app.estado.config.geral || {}), ...parcial }), texto);
}

function mudarTela(parcial) {
  Object.assign(app.ui, parcial);
  salvarPreferencias();
  app.desenhar();
}

function confirmarOficial(modId) {
  const info = app.modelo.modalidades[modId];
  const oficial = [];
  for (const l of info.calculada) if (l.posicao) oficial[l.posicao - 1] = l.id;
  gravar(
    app.loja.salvar('modalidades', modId, { ...info.doc, oficial: Array.from(oficial, (id) => id ?? null) }),
    'Classificação confirmada como oficial',
  );
}

function removerOficial(modId) {
  const doc = { ...app.modelo.modalidades[modId].doc };
  delete doc.oficial;
  gravar(app.loja.salvar('modalidades', modId, doc), 'Classificação oficial removida');
}

function exportarBackup() {
  const conteudo = JSON.stringify({ app: 'placar-interpuc', versao: 1, exportadoEm: new Date().toISOString(), dados: app.estado }, null, 2);
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `placar-interpuc-${hojeISO()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  aviso('Backup baixado');
}

async function lerBackup(campo) {
  const arquivo = campo.files?.[0];
  campo.value = '';
  if (!arquivo) return;
  try {
    const backup = JSON.parse(await arquivo.text());
    if (backup?.app !== 'placar-interpuc' || typeof backup.dados !== 'object') throw new Error('formato');
    folhaRestaurar(backup);
  } catch {
    aviso('Esse arquivo não é um backup do placar.', 'erro');
  }
}

function salvarNomes(form) {
  const dados = new FormData(form);
  const nomes = {};
  for (const a of ATLETICAS) {
    const valor = String(dados.get(a.id) || '').trim();
    if (valor) nomes[a.id] = valor;
  }
  salvarConfig({ nomes }, 'Nomes salvos');
}

// ---------- conta e equipe ----------

const ERROS_LOGIN = {
  'auth/popup-blocked': 'O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.',
  'auth/operation-not-allowed': 'O login com Google ainda não foi ativado no Firebase.',
  'auth/unauthorized-domain': 'Este endereço ainda não foi autorizado no Firebase.',
  'auth/network-request-failed': 'Sem conexão. Tente de novo quando a internet voltar.',
  'auth/web-storage-unsupported': 'Abra o link no Chrome ou no Safari para entrar: o navegador de dentro do WhatsApp e do Instagram não deixa.',
};

async function entrar() {
  try {
    const { user } = await app.loja.conta.entrar();
    aviso(`Você entrou como ${user.email}`);
  } catch (erro) {
    if (erro?.code === 'auth/popup-closed-by-user' || erro?.code === 'auth/cancelled-popup-request') return;
    console.error(erro);
    aviso(ERROS_LOGIN[erro?.code] || `Não deu para entrar: ${erro?.message || 'erro desconhecido'}`, 'erro');
  }
}

async function sair() {
  await app.loja.conta.sair();
  aviso('Você saiu. O placar continua aberto para consulta.');
}

function salvarEquipe(admins, editores, texto) {
  gravar(app.loja.equipe.salvar({ admins: [...admins], editores: [...editores], atualizadoEm: Date.now() }), texto);
}

function adicionarMembro(form) {
  const dados = new FormData(form);
  const email = normalizarEmail(dados.get('email'));
  const papel = dados.get('papel') === 'admins' ? 'admins' : 'editores';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    aviso('Digite um e-mail válido.', 'erro');
    return;
  }
  const admins = new Set(app.equipe?.admins || []);
  const editores = new Set(app.equipe?.editores || []);
  admins.delete(email);
  editores.delete(email);
  (papel === 'admins' ? admins : editores).add(email);
  salvarEquipe(admins, editores, `${email} entrou na equipe como ${papel === 'admins' ? 'administrador' : 'editor'}`);
  form.reset();
}

function removerMembro(el) {
  const email = el.dataset.email;
  const admins = new Set(app.equipe?.admins || []);
  const editores = new Set(app.equipe?.editores || []);
  admins.delete(email);
  editores.delete(email);
  salvarEquipe(admins, editores, `${email} saiu da equipe`);
}

function destacarNoAparelho(el) {
  app.ui.nossaLocal = el.value;
  salvarPreferencias();
  app.recalcular();
  app.desenhar();
  aviso(el.value ? `${app.modelo.nomes[el.value]} destacada neste aparelho` : 'Voltou para a atlética padrão');
}

export const cliques = {
  'novo-jogo': soEditor((el) => folhaJogo({ mod: el.dataset.mod || '', fase: el.dataset.fase || 'grupo' })),
  'editar-jogo': soEditor((el) => folhaJogo({ id: el.dataset.id })),
  'editar-grupos': soEditor((el) => folhaGrupos(el.dataset.mod)),
  'editar-oficial': soEditor((el) => folhaClassificacao(el.dataset.mod)),
  'confirmar-oficial': soEditor((el) => confirmarOficial(el.dataset.mod)),
  'remover-oficial': soEditor((el) => removerOficial(el.dataset.mod)),
  'editar-prova': soEditor((el) => folhaProva(el.dataset.mod, el.dataset.prova)),
  'nova-punicao': soEditor((el) => folhaPunicao({ mod: el.dataset.mod || '' })),
  'editar-punicao': soEditor((el) => folhaPunicao({ id: el.dataset.id })),
  'remarcar-dia': soEditor((el) => folhaRemarcar(el.dataset.data)),
  'apagar-tudo': soAdmin(folhaApagarTudo),
  'remover-membro': soAdmin(removerMembro),
  'aba-jogos': (el) => mudarTela({ abaJogos: el.dataset.aba }),
  'modo-geral': (el) => mudarTela({ modoGeral: el.dataset.modo }),
  exportar: exportarBackup,
  entrar,
  sair,
  recarregar: () => location.reload(),
};

export const mudancas = {
  nossa: soEditor((el) =>
    salvarConfig({ nossa: el.value || null }, el.value ? `${app.modelo.nomes[el.value]} agora é a atlética padrão` : 'Nenhuma atlética padrão'),
  ),
  'nossa-local': destacarNoAparelho,
  'so-nossos': (el) => mudarTela({ soNossos: el.checked }),
  'mod-jogos': (el) => mudarTela({ modJogos: el.value }),
  'wo-tecnico': soEditor((el) => salvarConfig({ woTecnicoPerde12: el.checked })),
  importar: soAdmin((el) => lerBackup(el)),
};

export const formularios = {
  nomes: soEditor(salvarNomes),
  equipe: soAdmin(adicionarMembro),
};
