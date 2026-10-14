// Ponto de entrada: abre o banco, recalcula o modelo a cada mudança e desenha a tela da rota atual.

import { firebaseConfig } from './firebase-config.js';
import { criarArmazenamento } from './armazenamento.js';
import { montarModelo } from './modelo.js';
import * as telas from './telas.js';
import { cliques, formularios, mudancas } from './acoes.js';
import { app, atualizarStatus, aviso, fecharFolha } from './contexto.js';

const principal = document.getElementById('app');
const folha = document.getElementById('folha');

// Rota → aba do rodapé que fica acesa.
const ABA_DA_TELA = { inicio: 'inicio', jogos: 'jogos', modalidades: 'modalidades', m: 'modalidades', geral: 'geral', a: 'geral', ajustes: 'ajustes' };

function rotaAtual() {
  const [tela = '', param = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { tela: ABA_DA_TELA[tela] ? tela : 'inicio', param: decodeURIComponent(param) };
}

let desenhoAdiado = false;

function desenhar({ topo = false } = {}) {
  if (!app.modelo) return;
  // Não apaga o que alguém está digitando quando chega uma atualização de outro diretor.
  const foco = document.activeElement;
  if (!topo && principal.contains(foco) && foco.matches('input:not([type="checkbox"]), textarea')) {
    desenhoAdiado = true;
    return;
  }
  desenhoAdiado = false;
  const { tela, param } = rotaAtual();
  const ctx = { modelo: app.modelo, ui: app.ui, modo: app.loja.modo };
  const telasPorRota = {
    inicio: () => telas.inicio(ctx),
    jogos: () => telas.jogos(ctx),
    modalidades: () => telas.modalidades(ctx),
    m: () => telas.modalidade(ctx, param),
    geral: () => telas.geral(ctx),
    a: () => telas.atletica(ctx, param),
    ajustes: () => telas.ajustes(ctx),
  };
  principal.innerHTML = telasPorRota[tela]();
  for (const link of document.querySelectorAll('.abas a')) {
    if (link.dataset.aba === ABA_DA_TELA[tela]) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (topo) window.scrollTo(0, 0);
}
app.desenhar = desenhar;

function marcarDia(caixa) {
  const valor = caixa.querySelector('input[type="date"]').value;
  for (const chip of caixa.querySelectorAll('[data-dia]')) chip.classList.toggle('ativo', chip.dataset.dia === valor);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-fechar]')) {
    fecharFolha();
    return;
  }
  const chip = e.target.closest('[data-dia]');
  if (chip) {
    const caixa = chip.closest('[data-seletor-data]');
    caixa.querySelector('input[type="date"]').value = chip.dataset.dia;
    marcarDia(caixa);
    return;
  }
  const alvo = e.target.closest('[data-acao]');
  if (alvo && cliques[alvo.dataset.acao]) {
    e.preventDefault();
    cliques[alvo.dataset.acao](alvo);
  }
});

document.addEventListener('change', (e) => {
  const alvo = e.target.closest('[data-mudar]');
  if (alvo && mudancas[alvo.dataset.mudar]) mudancas[alvo.dataset.mudar](alvo);
});

document.addEventListener('input', (e) => {
  const caixa = e.target.closest('[data-seletor-data]');
  if (caixa) marcarDia(caixa);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  formularios[form.dataset.form]?.(form);
});

principal.addEventListener('focusout', () => {
  if (desenhoAdiado) setTimeout(() => desenhoAdiado && desenhar(), 0);
});

// Toque fora da folha fecha a folha. (O conteúdo não é limpo no fechamento: o evento "close" pode
// chegar depois de outra folha já ter sido aberta e apagaria a nova. Cada abertura substitui tudo.)
folha.addEventListener('click', (e) => {
  if (e.target === folha) fecharFolha();
});

async function iniciar() {
  try {
    app.loja = await criarArmazenamento(firebaseConfig);
  } catch (erro) {
    console.error(erro);
    principal.innerHTML = telas.erroConexao(erro);
    return;
  }
  app.loja.aoFalhar((erro) => {
    app.erroConexao = erro;
    atualizarStatus();
    aviso(`O banco recusou a leitura: ${erro.message}`, 'erro');
  });
  atualizarStatus();
  app.loja.ouvir((estado) => {
    app.estado = estado;
    app.modelo = montarModelo(estado);
    atualizarStatus();
    desenhar();
  });
  window.addEventListener('hashchange', () => desenhar({ topo: true }));
}

iniciar();
