// Ponto de entrada: abre o banco, acompanha o login, recalcula o modelo a cada mudança e desenha a
// tela da rota atual.

import { donoHash, firebaseConfig } from './firebase-config.js';
import { criarArmazenamento } from './armazenamento.js';
import { montarModelo } from './modelo.js';
import { previsaoDoModelo, previsaoGuardada } from './previsao.js';
import { calcularPermissao, hashEmail } from './permissoes.js';
import * as telas from './telas.js';
import { cliques, formularios, mudancas } from './acoes.js';
import { app, atualizarStatus, aviso, fecharFolha } from './contexto.js';
import { esc } from './util.js';

const principal = document.getElementById('app');
const folha = document.getElementById('folha');
const areaConta = document.getElementById('conta');

// Rota → aba do rodapé que fica acesa.
const ABA_DA_TELA = { inicio: 'inicio', analise: 'inicio', jogos: 'jogos', modalidades: 'modalidades', m: 'modalidades', geral: 'geral', a: 'geral', ajustes: 'ajustes' };

function rotaAtual() {
  const [tela = '', param = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { tela: ABA_DA_TELA[tela] ? tela : 'inicio', param: decodeURIComponent(param) };
}

let desenhoAdiado = false;

// A previsão é só da equipe e leva alguns décimos de segundo: a tela sai primeiro ("calculando…") e
// é desenhada de novo quando a conta termina. Fica guardada até os dados mudarem.
let previsaoAgendada = null;
function previsaoAtual() {
  if (!app.pode.editar || !app.modelo) return null;
  const pronta = previsaoGuardada(app.modelo);
  if (pronta) return pronta;
  if (previsaoAgendada !== app.modelo) {
    const modelo = app.modelo;
    previsaoAgendada = modelo;
    setTimeout(() => {
      if (app.modelo === modelo) {
        try {
          previsaoDoModelo(modelo);
        } catch (erro) {
          console.error('Não deu para calcular a previsão', erro);
        }
        desenhar();
      }
    }, 30);
  }
  return null;
}

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
  const ctx = {
    modelo: app.modelo,
    ui: app.ui,
    modo: app.loja.modo,
    pode: app.pode,
    usuario: app.usuario,
    equipe: app.equipe,
    dono: app.dono,
    previsao: previsaoAtual(),
    analises: app.analises,
  };
  const telasPorRota = {
    inicio: () => telas.inicio(ctx),
    analise: () => telas.analise(ctx),
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

app.recalcular = () => {
  if (app.estado) app.modelo = montarModelo(app.estado, { nossaLocal: app.ui.nossaLocal });
};

// Botão de conta no topo: "Entrar" para quem não entrou; a inicial de quem entrou leva aos Ajustes.
function desenharConta() {
  if (!app.loja?.conta) {
    areaConta.innerHTML = '';
    return;
  }
  if (!app.usuario) {
    areaConta.innerHTML = '<button type="button" class="botao secundario pequeno" data-acao="entrar">Entrar</button>';
    return;
  }
  const inicial = (app.usuario.nome || app.usuario.email || '?').trim().charAt(0).toUpperCase();
  areaConta.innerHTML = `<a class="conta-avatar" href="#/ajustes" title="${esc(app.usuario.email)}" aria-label="Sua conta: ${esc(app.usuario.email)}">${esc(inicial)}</a>`;
}

function atualizarPermissao() {
  app.pode = calcularPermissao({ modo: app.loja.modo, usuario: app.usuario, equipe: app.equipe, dono: app.dono, semAcesso: app.semAcesso });
  acompanharAnalises();
  desenharConta();
  desenhar();
}

// Relatórios e destaques de atletas: só a equipe lê (no banco, quem não é da equipe recebe "sem permissão").
let pararAnalises = null;
function acompanharAnalises() {
  if (app.pode.editar && !pararAnalises && app.loja.analises) {
    pararAnalises = app.loja.analises.ouvir(
      (docs) => {
        app.analises = docs;
        desenhar();
      },
      (erro) => {
        console.error('Análises indisponíveis', erro);
        app.analises = {};
        desenhar();
      },
    );
  } else if (!app.pode.editar && pararAnalises) {
    pararAnalises();
    pararAnalises = null;
    app.analises = {};
  }
}

let pararEquipe = null;

function acompanharConta() {
  app.loja.conta.ouvir(async (usuario) => {
    pararEquipe?.();
    pararEquipe = null;
    app.usuario = usuario;
    app.equipe = null;
    app.semAcesso = false;
    app.dono = usuario ? (await hashEmail(usuario.email)) === donoHash : false;
    if (usuario) {
      // Só a equipe consegue ler a lista; para os outros, o banco responde "sem permissão".
      pararEquipe = app.loja.equipe.ouvir(
        (equipe) => {
          app.equipe = equipe;
          app.semAcesso = false;
          atualizarPermissao();
        },
        (erro) => {
          app.equipe = null;
          app.semAcesso = erro?.code === 'permission-denied';
          if (!app.semAcesso) console.error(erro);
          atualizarPermissao();
        },
      );
    }
    atualizarPermissao();
  });
}

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
  // Endereço com ?local: modo de teste, só neste aparelho e sem login, sem tocar no banco de verdade.
  const modoTeste = new URLSearchParams(location.search).has('local');
  try {
    app.loja = await criarArmazenamento(modoTeste ? null : firebaseConfig);
  } catch (erro) {
    console.error(erro);
    principal.innerHTML = telas.erroConexao(erro);
    return;
  }
  app.pode = calcularPermissao({ modo: app.loja.modo });
  acompanharAnalises();
  app.loja.aoFalhar((erro) => {
    app.erroConexao = erro;
    atualizarStatus();
    aviso(`O banco recusou a leitura: ${erro.message}`, 'erro');
  });
  atualizarStatus();
  desenharConta();
  if (app.loja.conta) acompanharConta();
  app.loja.ouvir((estado) => {
    app.estado = estado;
    app.recalcular();
    atualizarStatus();
    desenhar();
  });
  window.addEventListener('hashchange', () => desenhar({ topo: true }));
}

iniciar();
