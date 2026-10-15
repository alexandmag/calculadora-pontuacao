// Resumo do dia como imagem PNG, no visual do placar, para mandar no grupo do WhatsApp (a imagem aparece
// direto na conversa, sem abrir arquivo). Desenhado num canvas com 1080 px de largura; a altura acompanha
// o número de jogos. Usa os mesmos dados e textos do PDF (resumo.js).

import { COR, ENDERECO, ROTULO, detalhesDoJogo, linhaDaGeral, quando } from './resumo.js';

const LARGURA = 1080;
const M = 64; // margem lateral
const TEXTO = 'Barlow, system-ui, -apple-system, "Segoe UI", sans-serif';
const NUMERO = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
const rgb = (c) => `rgb(${c.join(',')})`;
const FUNDO = '#eceef1';
const BRANCO = '#ffffff';

// O canvas só usa a fonte da página se ela já estiver carregada.
async function garantirFontes() {
  if (!document.fonts?.load) return;
  const fontes = [`700 110px ${NUMERO}`, `600 40px ${NUMERO}`, `700 38px ${TEXTO}`, `600 28px ${TEXTO}`, `400 28px ${TEXTO}`];
  await Promise.all(fontes.map((f) => document.fonts.load(f).catch(() => null)));
}

function retangulo(ctx, x, y, w, h, raio, cor) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, raio);
  else {
    ctx.moveTo(x + raio, y);
    ctx.arcTo(x + w, y, x + w, y + h, raio);
    ctx.arcTo(x + w, y + h, x, y + h, raio);
    ctx.arcTo(x, y + h, x, y, raio);
    ctx.arcTo(x, y, x + w, y, raio);
    ctx.closePath();
  }
  ctx.fillStyle = cor;
  ctx.fill();
}

// Diminui a fonte até o texto caber; se nem no mínimo couber, corta com reticências.
function caber(ctx, texto, { peso, tamanho, familia, largura, minimo }) {
  let t = tamanho;
  ctx.font = `${peso} ${t}px ${familia}`;
  while (t > minimo && ctx.measureText(texto).width > largura) {
    t -= 2;
    ctx.font = `${peso} ${t}px ${familia}`;
  }
  let final = texto;
  while (final.length > 3 && ctx.measureText(final).width > largura) final = `${final.slice(0, -2)}…`;
  return final;
}

function quebrar(ctx, texto, largura) {
  const linhas = [];
  for (const paragrafo of String(texto).split('\n')) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (!atual || ctx.measureText(teste).width <= largura) atual = teste;
      else {
        linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

// Medidas de cada cartão de jogo, para saber a altura da imagem antes de desenhar.
const P = 36; // respiro interno do cartão
const COLUNA = 150; // largura da coluna do horário
const LINHA = 40;
const larguraConteudo = LARGURA - 2 * M - 2 * P - COLUNA;

function medirCartao(ctx, item) {
  ctx.font = `italic 400 28px ${TEXTO}`;
  const obs = item.obs ? quebrar(ctx, `Obs.: ${item.obs}`, larguraConteudo) : [];
  const detalhes = detalhesDoJogo(item);
  const altura = P + 44 + 44 + 82 + detalhes.length * LINHA + obs.length * LINHA + P - 8;
  return { item, obs, detalhes, altura };
}

// logo: HTMLImageElement do escudo, ou null.
export async function gerarImagem(resumo, { logo = null, geradoEm = new Date() } = {}) {
  await garantirFontes();
  const medidor = document.createElement('canvas').getContext('2d');
  const cartoes = resumo.itens.map((item) => medirCartao(medidor, item));
  const ALTURA_TOPO = 340;
  const yNumeros = ALTURA_TOPO + 36;
  const ALTURA_NUMEROS = 156;
  const yCartoes = yNumeros + ALTURA_NUMEROS + 32;
  const alturaCartoes = cartoes.length ? cartoes.reduce((soma, c) => soma + c.altura + 20, 0) : 140;
  const altura = yCartoes + alturaCartoes + 70;

  const tela = document.createElement('canvas');
  tela.width = LARGURA;
  tela.height = altura;
  const ctx = tela.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, LARGURA, altura);

  // Faixa de placar: atlética, dia, posição na geral e o escudo num quadro branco.
  ctx.fillStyle = rgb(COR.placar);
  ctx.fillRect(0, 0, LARGURA, ALTURA_TOPO);
  const LADO_LOGO = 236;
  const larguraTitulo = LARGURA - 2 * M - (logo ? LADO_LOGO + 32 : 0);
  ctx.fillStyle = rgb(COR.bronze);
  ctx.font = `600 28px ${TEXTO}`;
  ctx.fillText('INTERPUC MINAS 2026  ·  RESUMO DO DIA', M, 92);
  ctx.fillStyle = BRANCO;
  ctx.fillText(caber(ctx, resumo.atletica, { peso: 700, tamanho: 110, familia: NUMERO, largura: larguraTitulo, minimo: 64 }), M, 198);
  ctx.fillStyle = rgb(COR.placarTexto);
  ctx.font = `400 40px ${TEXTO}`;
  ctx.fillText(resumo.diaTexto, M, 254);
  if (resumo.geral) {
    ctx.fillStyle = rgb(COR.bronze);
    ctx.fillText(caber(ctx, linhaDaGeral(resumo.geral), { peso: 600, tamanho: 42, familia: NUMERO, largura: larguraTitulo, minimo: 30 }), M, 308);
  }
  if (logo) {
    const x = LARGURA - M - LADO_LOGO;
    const y = (ALTURA_TOPO - LADO_LOGO) / 2;
    retangulo(ctx, x, y, LADO_LOGO, LADO_LOGO, 28, BRANCO);
    const folga = 20;
    const escala = Math.min((LADO_LOGO - 2 * folga) / logo.naturalWidth, (LADO_LOGO - 2 * folga) / logo.naturalHeight);
    const w = logo.naturalWidth * escala;
    const h = logo.naturalHeight * escala;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo, x + (LADO_LOGO - w) / 2, y + (LADO_LOGO - h) / 2, w, h);
  }

  // Números do dia.
  const { totais } = resumo;
  const caixas = [
    ['Jogos', totais.jogos],
    ['Vitórias', totais.vitorias],
    ['Empates', totais.empates],
    ['Derrotas', totais.derrotas],
    ['A jogar', totais.pendentes],
  ];
  const vao = 16;
  const larguraCaixa = (LARGURA - 2 * M - vao * (caixas.length - 1)) / caixas.length;
  caixas.forEach(([rotulo, valor], i) => {
    const x = M + i * (larguraCaixa + vao);
    retangulo(ctx, x, yNumeros, larguraCaixa, ALTURA_NUMEROS, 24, BRANCO);
    ctx.fillStyle = rgb(COR.suave);
    ctx.font = `600 24px ${TEXTO}`;
    ctx.fillText(rotulo.toUpperCase(), x + 24, yNumeros + 48);
    ctx.fillStyle = rgb(COR.tinta);
    ctx.font = `700 88px ${NUMERO}`;
    ctx.fillText(String(valor), x + 24, yNumeros + 132);
  });

  // Um cartão por jogo.
  let y = yCartoes;
  if (!cartoes.length) {
    retangulo(ctx, M, y, LARGURA - 2 * M, 120, 24, BRANCO);
    ctx.fillStyle = rgb(COR.suave);
    ctx.font = `400 32px ${TEXTO}`;
    ctx.fillText('Nenhum jogo marcado neste dia.', M + P, y + 72);
  }
  for (const { item, obs, detalhes, altura: alturaCartao } of cartoes) {
    retangulo(ctx, M, y, LARGURA - 2 * M, alturaCartao, 24, BRANCO);
    const x0 = M + P;
    const xConteudo = x0 + COLUNA;
    let base = y + P + 44;

    ctx.fillStyle = rgb(COR.tinta);
    ctx.font = `700 52px ${NUMERO}`;
    ctx.fillText(item.hora || '--:--', x0, base);

    const [rotulo, cor] = ROTULO[item.resultado];
    ctx.font = `700 24px ${TEXTO}`;
    const larguraSelo = ctx.measureText(rotulo).width + 40;
    const xSelo = LARGURA - M - P - larguraSelo;
    retangulo(ctx, xSelo, y + P + 2, larguraSelo, 52, 26, rgb(cor));
    ctx.fillStyle = BRANCO;
    ctx.textAlign = 'center';
    ctx.fillText(rotulo, xSelo + larguraSelo / 2, y + P + 37);
    ctx.textAlign = 'left';

    ctx.fillStyle = rgb(COR.tinta);
    ctx.fillText(caber(ctx, item.modalidade, { peso: 700, tamanho: 38, familia: TEXTO, largura: xSelo - xConteudo - 20, minimo: 28 }), xConteudo, base);

    base += 44;
    ctx.fillStyle = rgb(COR.suave);
    ctx.font = `400 28px ${TEXTO}`;
    ctx.fillText([item.fase, item.local].filter(Boolean).join('  ·  '), xConteudo, base);

    base += 82;
    const placar = item.placar ? `${item.nos}  ${item.placar[0]} x ${item.placar[1]}  ${item.adversario}` : `${item.nos}  x  ${item.adversario}`;
    ctx.fillStyle = rgb(COR.tinta);
    ctx.fillText(caber(ctx, placar, { peso: 700, tamanho: 68, familia: NUMERO, largura: larguraConteudo, minimo: 44 }), xConteudo, base);

    ctx.fillStyle = rgb(COR.suave);
    ctx.font = `400 28px ${TEXTO}`;
    for (const linha of detalhes) {
      base += LINHA;
      ctx.fillText(linha, xConteudo, base);
    }
    ctx.fillStyle = rgb(COR.tinta);
    ctx.font = `italic 400 28px ${TEXTO}`;
    for (const linha of obs) {
      base += LINHA;
      ctx.fillText(linha, xConteudo, base);
    }
    y += alturaCartao + 20;
  }

  ctx.fillStyle = rgb(COR.suave);
  ctx.font = `400 24px ${TEXTO}`;
  ctx.fillText(`Placar INTERPUC · ${ENDERECO} · gerado em ${quando(geradoEm)}`, M, altura - 34);

  return new Promise((ok, falha) => tela.toBlob((blob) => (blob ? ok(blob) : falha(new Error('Não deu para gerar a imagem.'))), 'image/png'));
}
