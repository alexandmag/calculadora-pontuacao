// O que cada botão, seletor e formulário das telas faz (ligados por data-acao, data-mudar e data-form).

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
import { hojeISO } from './util.js';

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

export const cliques = {
  'novo-jogo': (el) => folhaJogo({ mod: el.dataset.mod || '', fase: el.dataset.fase || 'grupo' }),
  'editar-jogo': (el) => folhaJogo({ id: el.dataset.id }),
  'editar-grupos': (el) => folhaGrupos(el.dataset.mod),
  'editar-oficial': (el) => folhaClassificacao(el.dataset.mod),
  'confirmar-oficial': (el) => confirmarOficial(el.dataset.mod),
  'remover-oficial': (el) => removerOficial(el.dataset.mod),
  'editar-prova': (el) => folhaProva(el.dataset.mod, el.dataset.prova),
  'nova-punicao': (el) => folhaPunicao({ mod: el.dataset.mod || '' }),
  'editar-punicao': (el) => folhaPunicao({ id: el.dataset.id }),
  'remarcar-dia': (el) => folhaRemarcar(el.dataset.data),
  'aba-jogos': (el) => mudarTela({ abaJogos: el.dataset.aba }),
  'modo-geral': (el) => mudarTela({ modoGeral: el.dataset.modo }),
  exportar: exportarBackup,
  'apagar-tudo': folhaApagarTudo,
  recarregar: () => location.reload(),
};

export const mudancas = {
  nossa: (el) =>
    salvarConfig({ nossa: el.value || null }, el.value ? `${app.modelo.nomes[el.value]} agora é a nossa atlética` : 'Nenhuma atlética destacada'),
  'so-nossos': (el) => mudarTela({ soNossos: el.checked }),
  'mod-jogos': (el) => mudarTela({ modJogos: el.value }),
  'wo-tecnico': (el) => salvarConfig({ woTecnicoPerde12: el.checked }),
  importar: (el) => lerBackup(el),
};

export const formularios = {
  nomes: salvarNomes,
};
