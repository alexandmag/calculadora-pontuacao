// Resumo do dia de uma atlética em PDF, para mandar no grupo dos atletas: os jogos do dia com placar,
// parciais, observações e a situação no grupo, mais a posição na geral.
// dadosDoResumo é cálculo puro (testado); gerarPdf desenha com o jsPDF, carregado só quando precisa.

import { FASES, MODALIDADE, MODALIDADES } from './dados.js';
import { ESPORTES, placarEfetivo, vencedor } from './regras.js';
import { dataLonga, hojeISO, pad } from './util.js';

const NOME_FASE = Object.fromEntries(FASES.map((f) => [f.id, f.nome]));
const ORDEM_MOD = Object.fromEntries(MODALIDADES.map((m, i) => [m.id, i]));
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
export const ENDERECO = 'alexandmag.github.io/calculadora-pontuacao';

// Dias (com data marcada) em que a atlética tem jogo, do mais antigo ao mais recente.
export function diasComJogos(modelo, at) {
  const dias = new Set(modelo.jogos.filter((j) => j.data && (j.a === at || j.b === at)).map((j) => j.data));
  return [...dias].sort();
}

// Hoje, se tiver jogo; senão o último dia que já passou; senão o próximo.
export function diaPadrao(dias, hoje = hojeISO()) {
  if (dias.includes(hoje)) return hoje;
  const passados = dias.filter((d) => d < hoje);
  return passados.length ? passados[passados.length - 1] : dias[0] || '';
}

export function dadosDoResumo(modelo, at, dia) {
  const nome = (id) => modelo.nomes[id] ?? '—';
  const jogos = modelo.jogos
    .filter((j) => j.data === dia && (j.a === at || j.b === at))
    .sort((x, y) => (x.hora || '99:99').localeCompare(y.hora || '99:99') || (ORDEM_MOD[x.mod] ?? 99) - (ORDEM_MOD[y.mod] ?? 99));

  const itens = jogos.map((j) => {
    const m = MODALIDADE[j.mod];
    const esporte = ESPORTES[m.esporte];
    const lado = j.a === at ? 'a' : 'b';
    const outro = lado === 'a' ? 'b' : 'a';
    const p = placarEfetivo(j, esporte);
    const v = p ? vencedor(j, esporte) : null;
    let resultado = 'pendente';
    if (p && j.res.wo) resultado = j.res.wo === lado ? 'wo-contra' : 'wo-favor';
    else if (p) resultado = v === 'empate' ? 'empate' : v === lado ? 'vitoria' : 'derrota';
    // Sempre do ponto de vista da atlética do resumo: o placar dela vem primeiro.
    const parciais = p?.parciais && !j.res.wo ? p.parciais.map(([x, y]) => (lado === 'a' ? [x, y] : [y, x])) : null;
    const penaltis = p?.penaltis && p.a === p.b ? (lado === 'a' ? [p.penaltis.a, p.penaltis.b] : [p.penaltis.b, p.penaltis.a]) : null;

    let grupo = null;
    if (j.fase === 'grupo') {
      const info = modelo.modalidades[j.mod];
      const letra = Object.keys(info.grupos || {}).find((l) => info.grupos[l].includes(at));
      const linha = letra && info.tabelas?.[letra]?.tabela.find((l) => l.id === at);
      if (linha) grupo = { letra, posicao: linha.posicao, pts: linha.pts, jogos: linha.j, eliminado: Boolean(linha.eliminado) };
    }

    return {
      hora: j.hora || '',
      modalidade: m.nome,
      fase: j.fase === 'grupo' ? `Grupo ${j.grupo || '?'}` : NOME_FASE[j.fase] || j.fase,
      local: j.local || '',
      nos: nome(at),
      adversario: nome(j[outro]),
      placar: p ? [p[lado], p[outro]] : null,
      sets: Boolean(esporte.sets),
      parciais,
      penaltis,
      decisao: esporte.decisao || 'desempate',
      resultado,
      woTecnico: j.res?.woTipo === 'tecnico',
      obs: (j.obs || '').trim(),
      grupo,
    };
  });

  const conta = (...tipos) => itens.filter((i) => tipos.includes(i.resultado)).length;
  const temResultados = modelo.geral.projecao.some((l) => l.detalhe.length || l.ajustes.length);
  const geral = modelo.geral.projecao.find((l) => l.id === at);
  return {
    atletica: nome(at),
    dia,
    diaTexto: dataLonga(dia),
    itens,
    totais: {
      jogos: itens.length,
      vitorias: conta('vitoria', 'wo-favor'),
      empates: conta('empate'),
      derrotas: conta('derrota', 'wo-contra'),
      pendentes: conta('pendente'),
    },
    geral: temResultados && geral ? { posicao: geral.posicao, total: geral.total } : null,
  };
}

// As fontes padrão do PDF só têm os caracteres do português "latino": troca o resto e tira emojis.
export function textoParaPdf(texto) {
  return String(texto ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[•●]/g, '-')
    .replace(/[^\n\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

export function nomeDoArquivo(resumo) {
  const slug = resumo.atletica
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `resumo-${slug || 'atletica'}-${resumo.dia}.pdf`;
}

// ---------- PDF ----------

let carregando = null;

// O gerador de PDF só é baixado quando alguém abre o resumo.
export function carregarJsPDF() {
  if (globalThis.jspdf?.jsPDF) return Promise.resolve(globalThis.jspdf.jsPDF);
  carregando ??= new Promise((ok, falha) => {
    const script = document.createElement('script');
    script.src = JSPDF;
    script.onload = () => (globalThis.jspdf?.jsPDF ? ok(globalThis.jspdf.jsPDF) : falha(new Error('gerador de PDF incompleto')));
    script.onerror = () => {
      carregando = null;
      falha(new Error('Não deu para carregar o gerador de PDF. Confira a internet e tente de novo.'));
    };
    document.head.append(script);
  });
  return carregando;
}

const COR = {
  tinta: [21, 24, 28],
  suave: [91, 99, 110],
  linha: [218, 222, 228],
  caixa: [244, 245, 247],
  placar: [23, 25, 28],
  placarTexto: [244, 239, 230],
  placarSuave: [179, 171, 159],
  bronze: [224, 171, 98],
  bronzeEscuro: [138, 90, 31],
  vitoria: [29, 122, 72],
  derrota: [179, 38, 30],
  empate: [91, 99, 110],
};

const ROTULO = {
  vitoria: ['VITÓRIA', COR.vitoria],
  empate: ['EMPATE', COR.empate],
  derrota: ['DERROTA', COR.derrota],
  'wo-favor': ['VITÓRIA POR W.O.', COR.vitoria],
  'wo-contra': ['DERROTA POR W.O.', COR.derrota],
  pendente: ['A JOGAR', COR.bronzeEscuro],
};

function detalhesDoJogo(item) {
  const linhas = [];
  if (item.resultado === 'pendente') linhas.push('Resultado ainda não lançado.');
  if (item.resultado === 'wo-favor') linhas.push(`${item.adversario} não compareceu.`);
  if (item.resultado === 'wo-contra') linhas.push(item.woTecnico ? 'W.O. técnico: fora da modalidade.' : 'W.O.: fora da modalidade e -12 pontos na geral.');
  if (item.parciais) linhas.push(`Parciais: ${item.parciais.map(([x, y]) => `${x}-${y}`).join(', ')}`);
  if (item.penaltis) linhas.push(`Decidido nos ${item.decisao}: ${item.penaltis[0]} x ${item.penaltis[1]}`);
  if (item.grupo && !item.grupo.eliminado && item.grupo.jogos > 0) {
    linhas.push(`Situação no Grupo ${item.grupo.letra}: ${item.grupo.posicao}º lugar, ${item.grupo.pts} ${item.grupo.pts === 1 ? 'ponto' : 'pontos'} em ${item.grupo.jogos} ${item.grupo.jogos === 1 ? 'jogo' : 'jogos'}`);
  }
  return linhas;
}

function quando(data) {
  return `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()} às ${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

export function gerarPdf(JsPDF, resumo, { geradoEm = new Date() } = {}) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const LARGURA = 210;
  const ALTURA = 297;
  const M = 16;
  const util = LARGURA - 2 * M;
  const t = textoParaPdf;
  const fonte = (estilo, tamanho, cor) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  };

  // Faixa de placar no topo, com a posição na geral à direita.
  doc.setFillColor(...COR.placar);
  doc.rect(0, 0, LARGURA, 44, 'F');
  fonte('bold', 8.5, COR.bronze);
  doc.text('INTERPUC MINAS 2026  ·  RESUMO DO DIA', M, 13);
  fonte('bold', 24, [255, 255, 255]);
  doc.text(t(resumo.atletica), M, 26);
  fonte('normal', 12, COR.placarTexto);
  doc.text(t(resumo.diaTexto), M, 35);
  if (resumo.geral) {
    fonte('bold', 8.5, COR.bronze);
    doc.text('GERAL (PROJEÇÃO)', LARGURA - M, 13, { align: 'right' });
    fonte('bold', 22, [255, 255, 255]);
    doc.text(`${resumo.geral.posicao}º`, LARGURA - M, 26, { align: 'right' });
    fonte('normal', 12, COR.placarTexto);
    doc.text(t(`${resumo.geral.total} ${Math.abs(resumo.geral.total) === 1 ? 'ponto' : 'pontos'}`), LARGURA - M, 35, { align: 'right' });
  }

  // Números do dia.
  let y = 52;
  const { totais } = resumo;
  const caixas = [
    ['Jogos', totais.jogos],
    ['Vitórias', totais.vitorias],
    ['Empates', totais.empates],
    ['Derrotas', totais.derrotas],
    ['A jogar', totais.pendentes],
  ];
  const espaco = 4;
  const larguraCaixa = (util - espaco * (caixas.length - 1)) / caixas.length;
  caixas.forEach(([rotulo, valor], i) => {
    const x = M + i * (larguraCaixa + espaco);
    doc.setFillColor(...COR.caixa);
    doc.roundedRect(x, y, larguraCaixa, 17, 2, 2, 'F');
    fonte('normal', 8, COR.suave);
    doc.text(t(rotulo.toUpperCase()), x + 3.5, y + 6);
    fonte('bold', 15, COR.tinta);
    doc.text(String(valor), x + 3.5, y + 13.5);
  });
  y += 27;

  if (!resumo.itens.length) {
    fonte('normal', 11, COR.suave);
    doc.text('Nenhum jogo marcado neste dia.', M, y + 4);
  }

  // Um bloco por jogo, na ordem do horário.
  const recuo = 22;
  for (const item of resumo.itens) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    const obs = item.obs ? doc.splitTextToSize(t(`Obs.: ${item.obs}`), util - recuo) : [];
    const detalhes = detalhesDoJogo(item);
    const altura = 22 + detalhes.length * 5 + obs.length * 4.6 + 6;
    if (y + altura > ALTURA - 18) {
      doc.addPage();
      y = M;
    }

    fonte('bold', 13, COR.tinta);
    doc.text(t(item.hora || '--:--'), M, y + 5.5);
    fonte('bold', 12, COR.tinta);
    doc.text(t(item.modalidade), M + recuo, y + 5.5);
    fonte('normal', 9, COR.suave);
    doc.text(t([item.fase, item.local].filter(Boolean).join('  ·  ')), M + recuo, y + 10.5);

    const [rotulo, cor] = ROTULO[item.resultado];
    fonte('bold', 8, [255, 255, 255]);
    const larguraSelo = doc.getTextWidth(t(rotulo)) + 7;
    doc.setFillColor(...cor);
    doc.roundedRect(LARGURA - M - larguraSelo, y + 1, larguraSelo, 6.5, 3.2, 3.2, 'F');
    doc.text(t(rotulo), LARGURA - M - larguraSelo / 2, y + 5.4, { align: 'center' });

    fonte('bold', 15, COR.tinta);
    const placar = item.placar ? `${item.nos}  ${item.placar[0]} x ${item.placar[1]}  ${item.adversario}` : `${item.nos}  x  ${item.adversario}`;
    let yy = y + 19;
    doc.text(t(placar), M + recuo, yy);

    fonte('normal', 9.5, COR.suave);
    for (const linha of detalhes) {
      yy += 5;
      doc.text(t(linha), M + recuo, yy);
    }
    if (obs.length) {
      fonte('italic', 9.5, COR.tinta);
      for (const linha of obs) {
        yy += 4.6;
        doc.text(linha, M + recuo, yy);
      }
    }
    y = yy + 5;
    doc.setDrawColor(...COR.linha);
    doc.setLineWidth(0.25);
    doc.line(M, y, LARGURA - M, y);
    y += 6;
  }

  // Rodapé em todas as páginas.
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    fonte('normal', 8, COR.suave);
    doc.text(t(`Placar INTERPUC · ${ENDERECO} · gerado em ${quando(geradoEm)}`), M, ALTURA - 8);
    doc.text(`${i}/${paginas}`, LARGURA - M, ALTURA - 8, { align: 'right' });
  }
  return doc;
}

// No celular abre a folha de compartilhar (WhatsApp, Telegram...); no computador, baixa o arquivo.
export function podeCompartilharArquivo() {
  try {
    const teste = new File([new Blob(['%PDF'])], 'teste.pdf', { type: 'application/pdf' });
    return Boolean(navigator.canShare?.({ files: [teste] }));
  } catch {
    return false;
  }
}

export function baixarArquivo(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function compartilharArquivo(blob, nomeArquivo, titulo) {
  const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [arquivo], title: titulo });
    return 'compartilhado';
  } catch (erro) {
    if (erro?.name === 'AbortError') return 'cancelado';
    baixarArquivo(blob, nomeArquivo); // o navegador recusou o compartilhamento: baixa no lugar
    return 'baixado';
  }
}
