// Quem pode fazer o quê. Qualquer pessoa com o link vê o placar; editar exige entrar com uma conta
// Google que esteja na equipe (edicoes/2026/acesso/equipe). As regras do Firestore conferem o mesmo
// no servidor: aqui é só para a tela mostrar ou esconder os botões de edição.

export const PAPEIS = {
  local: 'Modo local',
  visitante: 'Visitante',
  'sem-acesso': 'Sem permissão para editar',
  editor: 'Editor',
  admin: 'Administrador',
};

export function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// modo: 'local' (sem Firebase: tudo liberado) ou 'compartilhado'.
// dono: o e-mail da pessoa logada bate com o hash do dono (sempre administrador).
// semAcesso: o banco recusou a leitura da equipe para essa conta.
export function calcularPermissao({ modo, usuario = null, equipe = null, dono = false, semAcesso = false }) {
  if (modo !== 'compartilhado') return { editar: true, administrar: true, papel: 'local' };
  if (!usuario) return { editar: false, administrar: false, papel: 'visitante' };
  const email = normalizarEmail(usuario.email);
  const admins = (equipe?.admins || []).map(normalizarEmail);
  const editores = (equipe?.editores || []).map(normalizarEmail);
  const administrar = dono || (!semAcesso && admins.includes(email));
  const editar = administrar || (!semAcesso && editores.includes(email));
  return { editar, administrar, papel: administrar ? 'admin' : editar ? 'editor' : 'sem-acesso' };
}

// SHA-256 do e-mail em hexadecimal, igual ao hashing.sha256(...).toHexString() das regras do Firestore.
export async function hashEmail(email) {
  const resumo = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizarEmail(email)));
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
