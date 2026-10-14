// Estado do app em memória e as peças de interface usadas por várias telas:
// avisos rápidos, a folha de edição (janela que sobe de baixo) e o indicador de gravação.

import { esc } from './util.js';

const PREFERENCIAS = 'placar-interpuc-preferencias';

function lerPreferencias() {
  // nossaLocal: atlética destacada neste aparelho ('' = a padrão da equipe).
  const padrao = { soNossos: true, abaJogos: 'abertos', modJogos: '', modoGeral: 'projecao', nossaLocal: '' };
  try {
    return { ...padrao, ...JSON.parse(localStorage.getItem(PREFERENCIAS) || '{}') };
  } catch {
    return padrao;
  }
}

export const app = {
  loja: null,
  estado: null,
  modelo: null,
  ui: lerPreferencias(),
  pendentes: 0,
  erroConexao: null,
  usuario: null, // { uid, email, nome } de quem entrou com Google
  equipe: null, // { admins: [e-mails], editores: [e-mails] }
  dono: false,
  semAcesso: false,
  pode: { editar: false, administrar: false, papel: 'visitante' },
  desenhar: () => {},
  recalcular: () => {},
};

// Filtros e abas escolhidos ficam lembrados só neste aparelho.
export function salvarPreferencias() {
  try {
    localStorage.setItem(PREFERENCIAS, JSON.stringify(app.ui));
  } catch {
    // sem armazenamento local (aba anônima): os filtros só não ficam lembrados
  }
}

let temporizador;
export function aviso(texto, tipo = 'ok') {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.dataset.tipo = tipo;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    el.hidden = true;
  }, tipo === 'erro' ? 7000 : 2600);
}

export function atualizarStatus() {
  const el = document.getElementById('status');
  if (!el || !app.loja) return;
  let texto = 'Só neste aparelho';
  let tipo = 'local';
  if (app.erroConexao) {
    texto = 'Sem acesso ao banco';
    tipo = 'erro';
  } else if (app.pendentes > 0) {
    texto = 'Salvando…';
    tipo = 'salvando';
  } else if (app.loja.modo === 'compartilhado') {
    texto = 'Ao vivo';
    tipo = 'ok';
  }
  el.textContent = texto;
  el.dataset.tipo = tipo;
}

function explicarErro(erro) {
  if (erro?.code === 'permission-denied') return 'sua conta não tem permissão para editar. Entre com uma conta da equipe (Ajustes → Conta).';
  if (erro?.code === 'unavailable') return 'sem conexão. A mudança será enviada quando a internet voltar.';
  return erro?.message || 'erro desconhecido.';
}

// Grava sem travar a tela: o Firestore mostra a mudança na hora e confirma com o servidor depois.
// Sem internet, o "Salvando…" fica no topo até a conexão voltar.
export function gravar(promessa, textoOk) {
  app.pendentes++;
  atualizarStatus();
  if (textoOk) aviso(textoOk);
  return Promise.resolve(promessa)
    .catch((erro) => {
      console.error(erro);
      aviso(`Não deu para salvar: ${explicarErro(erro)}`, 'erro');
    })
    .finally(() => {
      app.pendentes--;
      atualizarStatus();
    });
}

const ICONE_FECHAR =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

// Abre a folha de edição. aoEnviar recebe (FormData, form, ação do botão) e devolve:
// uma mensagem de erro (texto) para manter a folha aberta, false para manter sem erro, ou nada para fechar.
// Botões com data-confirmar pedem um segundo toque antes de agir.
export function abrirFolha({ titulo, contexto = '', corpo, rodape, aoEnviar, aoAbrir }) {
  const folha = document.getElementById('folha');
  folha.innerHTML = `<form class="folha-form" novalidate>
      <header class="folha-topo">
        <div><h2>${esc(titulo)}</h2>${contexto ? `<p class="folha-contexto">${esc(contexto)}</p>` : ''}</div>
        <button type="button" class="botao-icone" data-fechar aria-label="Fechar">${ICONE_FECHAR}</button>
      </header>
      <div class="folha-corpo">${corpo}<p class="folha-erro" role="alert" hidden></p></div>
      <footer class="folha-rodape">${rodape}</footer>
    </form>`;
  const form = folha.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const botao = e.submitter;
    if (botao?.dataset.confirmar && !botao.dataset.armado) {
      botao.dataset.armado = '1';
      botao.textContent = botao.dataset.confirmar;
      return;
    }
    const caixaErro = form.querySelector('.folha-erro');
    caixaErro.hidden = true;
    const resultado = aoEnviar(new FormData(form), form, botao?.value || 'salvar');
    if (typeof resultado === 'string') {
      caixaErro.textContent = resultado;
      caixaErro.hidden = false;
      caixaErro.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (resultado !== false) fecharFolha();
  });
  if (!folha.open) folha.showModal();
  aoAbrir?.(form);
}

export function fecharFolha() {
  const folha = document.getElementById('folha');
  if (folha.open) folha.close();
}
