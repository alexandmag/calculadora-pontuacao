const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const pad = (n) => String(n).padStart(2, '0');

// Tudo que vem do banco passa por aqui antes de virar HTML.
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function partesData(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return { m, d, semana: new Date(a, m - 1, d).getDay() };
}

export function dataCurta(iso) {
  if (!iso) return 'Sem data';
  const { m, d, semana } = partesData(iso);
  return `${DIAS[semana]} ${pad(d)}/${pad(m)}`;
}

export function dataLonga(iso) {
  if (!iso) return 'Sem data definida';
  const { m, d, semana } = partesData(iso);
  return `${DIAS_LONGOS[semana]}, ${d} de ${MESES[m - 1]}`;
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ordinal(n) {
  return n ? `${n}º` : '—';
}

// Número com o sinal de menos tipográfico, que tem a largura certa ao lado dos algarismos.
export function inteiro(n) {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}

export function pts(n) {
  return `${inteiro(n)} ${Math.abs(n) === 1 ? 'pt' : 'pts'}`;
}

export function comSinal(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

export function novoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// Campo numérico de formulário: vazio vira null; aceita só inteiros a partir de zero.
export function numero(valor) {
  const texto = String(valor ?? '').trim();
  if (texto === '') return null;
  const n = Number(texto);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}
