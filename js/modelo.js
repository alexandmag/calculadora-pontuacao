// Junta os dados lançados com as regras e calcula tudo o que as telas mostram.
// Roda de novo a cada mudança: são poucas dezenas de jogos, então recalcular é instantâneo.

import { ATLETICAS, LETRAS_GRUPO, MODALIDADES } from './dados.js';
import {
  ESPORTES,
  PERDA_WO,
  classificacaoColetiva,
  classificacaoGeral,
  placarEfetivo,
  pontuacaoProvas,
} from './regras.js';

export const TIPOS_PUNICAO = {
  wo: { nome: 'W.O.', pontos: PERDA_WO, zera: true },
  wo_tecnico: { nome: 'W.O. técnico', pontos: 0, zera: true },
  fraude: { nome: 'Fraude na inscrição', pontos: -80, zera: true },
  outra: { nome: 'Outra punição', pontos: 0, zera: false },
};

export function chaveResultado(modId, provaId) {
  return `${modId}__${provaId}`;
}

export function gruposDaModalidade(doc) {
  const grupos = {};
  for (const letra of LETRAS_GRUPO) grupos[letra] = [];
  for (const a of ATLETICAS) {
    const letra = doc?.grupoDe?.[a.id];
    if (letra && grupos[letra]) grupos[letra].push(a.id);
  }
  return Object.fromEntries(Object.entries(grupos).filter(([, membros]) => membros.length > 0));
}

export function montarModelo(estado) {
  const config = estado.config.geral || {};
  const nomes = Object.fromEntries(ATLETICAS.map((a) => [a.id, config.nomes?.[a.id]?.trim() || a.curto]));
  const jogos = Object.entries(estado.jogos).map(([id, j]) => ({ ...j, id }));
  const punicoes = Object.entries(estado.penalidades).map(([id, p]) => ({ ...p, id }));

  const modalidades = {};
  for (const m of MODALIDADES) {
    const doc = estado.modalidades[m.id] || {};
    const info = { m, doc, jogos: jogos.filter((j) => j.mod === m.id), calculada: [], oficial: null, wo: new Map() };

    if (m.tipo === 'coletiva') {
      info.esporte = ESPORTES[m.esporte];
      info.grupos = gruposDaModalidade(doc);
      // Com repescagem, só o líder de cada grupo vai direto à semifinal; sem ela, vão os dois primeiros.
      const vagasDiretas = m.repescagem ? 1 : 2;
      const r = classificacaoColetiva({ grupos: info.grupos, jogos: info.jogos, esporte: info.esporte, vagasDiretas });
      info.tabelas = r.tabelas;
      info.wo = r.wo;
      info.participantes = r.ordem.length;
      info.temDados = info.jogos.some((j) => placarEfetivo(j, info.esporte));
      // Sem nenhum resultado, a ordem seria só a da lista de atléticas: não projeta pontos.
      info.calculada = info.temDados ? r.ordem : [];
    } else if (m.tipo === 'provas') {
      info.resultados = Object.fromEntries(
        m.provas.map((p) => [p.id, estado.resultados[chaveResultado(m.id, p.id)]?.linhas || []]),
      );
      info.pontuacao = pontuacaoProvas(m.provas, info.resultados);
      info.calculada = info.pontuacao.ordem.map(({ id, posicao, empatado }) => ({ id, posicao, empatado }));
      info.participantes = info.pontuacao.ordem.length + info.pontuacao.semPontos.length;
      info.temDados = info.participantes > 0;
    }

    if (Array.isArray(doc.oficial) && doc.oficial.some(Boolean)) {
      info.oficial = doc.oficial.map((id, i) => (id ? { id, posicao: i + 1 } : null)).filter(Boolean);
    }
    info.estado = info.oficial ? 'oficial' : info.temDados ? 'andamento' : 'aguardando';
    // A projeção usa a classificação oficial quando ela existe; senão, a calculada até agora.
    info.vigente = info.oficial || info.calculada;
    modalidades[m.id] = info;
  }

  // Perdas de pontos e modalidades zeradas (RG Arts. 23 e 27).
  const zerados = new Set();
  const ajustes = [];
  for (const p of punicoes) {
    if (!p.at || !TIPOS_PUNICAO[p.tipo]) continue;
    if (p.mod && TIPOS_PUNICAO[p.tipo].zera) zerados.add(`${p.mod}|${p.at}`);
    if (p.pontos) ajustes.push({ id: p.at, pontos: p.pontos, motivo: p.motivo || TIPOS_PUNICAO[p.tipo].nome, mod: p.mod || null, punicao: p.id });
  }
  for (const [modId, info] of Object.entries(modalidades)) {
    for (const [at, tipo] of info.wo) {
      zerados.add(`${modId}|${at}`);
      const perde12 = tipo === 'normal' || config.woTecnicoPerde12;
      const jaLancada = punicoes.some((p) => p.at === at && p.mod === modId && (p.tipo === 'wo' || p.tipo === 'wo_tecnico'));
      if (perde12 && !jaLancada) {
        ajustes.push({
          id: at,
          pontos: PERDA_WO,
          motivo: `W.O.${tipo === 'tecnico' ? ' técnico' : ''} no ${info.m.curto}`,
          mod: modId,
          automatico: true,
        });
      }
    }
  }

  const ids = ATLETICAS.map((a) => a.id);
  const geral = {
    projecao: classificacaoGeral({
      atleticas: ids,
      classificacoes: MODALIDADES.map((m) => ({ mod: m.id, ordem: modalidades[m.id].vigente })),
      zerados,
      ajustes,
    }),
    oficial: classificacaoGeral({
      atleticas: ids,
      classificacoes: MODALIDADES.filter((m) => modalidades[m.id].oficial).map((m) => ({ mod: m.id, ordem: modalidades[m.id].oficial })),
      zerados,
      ajustes,
    }),
  };

  return {
    config,
    nomes,
    nossa: config.nossa || null,
    jogos,
    punicoes,
    ajustes,
    zerados,
    modalidades,
    geral,
    oficiais: MODALIDADES.filter((m) => modalidades[m.id].oficial).length,
  };
}
