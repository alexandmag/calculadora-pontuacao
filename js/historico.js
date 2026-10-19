// INTERPUC Minas 10ª edição (2025): pontos de cada atlética em cada modalidade na classificação geral
// final (Boletim Oficial nº 17, 15/11/2025, e boletins 12 e 13 para conferir). Serve de ponto de partida
// para a previsão de 2026: muita gente mudou de um ano para o outro, então o modelo usa com cautela.

import { pontosPorColocacao } from './regras.js';

// Ordem das colunas do boletim (as mesmas 24 modalidades de 2026).
const COLUNAS = [
  'futsal-m', 'futsal-f', 'handebol-m', 'handebol-f', 'basquete-m', 'basquete-f', 'volei-m', 'volei-f', 'futebol-m',
  'xadrez', 'atletismo-m', 'atletismo-f', 'tenis-mesa-m', 'tenis-mesa-f', 'tenis-m', 'tenis-f', 'natacao-m', 'natacao-f',
  'peteca-m', 'peteca-f', 'judo-m', 'judo-f', 'jiujitsu-m', 'jiujitsu-f',
];

// Atléticas de 2025 → ids de 2026. "Vetich" era Veterinária e ICH juntas; em 2026 estão separadas.
const LINHAS_2025 = [
  { nome: 'Touros', ids: ['ef'], perdas: 0, pontos: [7, 12, 9, 12, 0, 12, 0, 9, 12, 9, 12, 9, 5, 12, 5, 5, 5, 5, 0, 5, 4, 12, 5, 9] },
  { nome: 'Direito', ids: ['dir'], perdas: 0, pontos: [0, 9, 5, 2, 0, 9, 12, 12, 9, 4, 7, 5, 3, 3, 3, 12, 7, 12, 9, 4, 12, 4, 12, 7] },
  { nome: 'Medicina', ids: ['med'], perdas: 0, pontos: [1, 5, 4, 7, 9, 7, 1, 7, 4, 5, 9, 12, 12, 9, 0, 9, 2, 3, 7, 12, 3, 2, 7, 4] },
  { nome: 'Engenharia', ids: ['eng'], perdas: 0, pontos: [5, 1, 12, 1, 12, 2, 5, 5, 7, 7, 5, 7, 9, 5, 4, 7, 12, 4, 1, 0, 2, 3, 1, 1] },
  { nome: 'Vikings Gerenciais', ids: ['ger'], perdas: 0, pontos: [4, 2, 7, 0, 7, 3, 7, 2, 5, 3, 4, 0, 0, 4, 12, 4, 4, 0, 2, 9, 9, 7, 4, 3] },
  { nome: 'Manada', ids: ['odo'], perdas: 0, pontos: [0, 0, 1, 3, 2, 4, 0, 3, 1, 12, 2, 2, 4, 7, 2, 1, 3, 2, 0, 2, 5, 9, 2, 12] },
  { nome: 'Alfa', ids: ['psi'], perdas: 0, pontos: [2, 7, 2, 9, 1, 5, 4, 0, 0, 1, 0, 3, 1, 2, 7, 2, 1, 1, 0, 3, 0, 5, 3, 5] },
  { nome: 'Pinguins', ids: ['icei'], perdas: 0, pontos: [12, 0, 3, 0, 4, 0, 9, 0, 3, 2, 0, 0, 7, 0, 0, 0, 9, 0, 12, 1, 0, 0, 0, 0] },
  { nome: 'Ajac', ids: ['com'], perdas: 0, pontos: [9, 3, 0, 5, 5, 1, 3, 1, 0, 0, 0, 1, 0, 0, 1, 3, 0, 9, 0, 0, 7, 1, 0, 0] },
  { nome: 'Vikings RI', ids: ['ics'], perdas: 0, pontos: [0, 0, 0, 0, 3, 0, 0, 0, 2, 0, 3, 0, 0, 0, 9, 0, 0, 7, 3, 7, 1, 0, 0, 2] },
  { nome: 'Raptors', ids: ['bio'], perdas: -12, pontos: [0, 4, 0, 4, 0, 0, 0, 0, 0, 0, 1, 4, 0, 1, 0, 0, 0, 0, 5, 0, 0, 0, 9, 0] },
  { nome: 'Vetich', ids: ['vet', 'ich'], perdas: -12, pontos: [3, 0, 0, 0, 0, 0, 2, 4, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0] },
];

// As 9 coletivas de quadra e campo; o resto (lutas, provas, raquetes, xadrez, peteca) conta como "individuais".
export const COLETIVAS_PRINCIPAIS = COLUNAS.slice(0, 9);

export const EDICAO_2025 = {
  titulo: 'INTERPUC Minas 10ª edição (2025)',
  fonte: 'Boletins oficiais nº 12, 13 e 17',
  linhas: LINHAS_2025.map((l) => {
    const porMod = Object.fromEntries(COLUNAS.map((mod, i) => [mod, l.pontos[i]]));
    const soma = (mods) => mods.reduce((s, m) => s + porMod[m], 0);
    const coletivas = soma(COLETIVAS_PRINCIPAIS);
    const total = soma(COLUNAS);
    return { nome: l.nome, ids: l.ids, porMod, coletivas, individuais: total - coletivas, perdas: l.perdas, total: total + l.perdas };
  }).sort((x, y) => y.total - x.total),
};

// Pontos de 2025 de uma atlética de 2026 numa modalidade (0 se não pontuou ou não existia).
const porId = Object.fromEntries(EDICAO_2025.linhas.flatMap((l) => l.ids.map((id) => [id, l])));
export function pontos2025(id, mod) {
  return porId[id]?.porMod[mod] ?? 0;
}
export function linha2025(id) {
  return porId[id] || null;
}

// Colocação de 2025 a partir dos pontos (12 → 1º, 9 → 2º... 0 → fora dos 8).
export function colocacao2025(id, mod) {
  const p = pontos2025(id, mod);
  for (let pos = 1; pos <= 8; pos++) if (pontosPorColocacao(pos) === p) return p ? pos : null;
  return null;
}
