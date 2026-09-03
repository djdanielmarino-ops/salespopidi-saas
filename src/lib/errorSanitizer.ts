/**
 * Sanitizes database errors to prevent leaking internal details to the browser console.
 */
export function sanitizeDbError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Operação falhou. Tente novamente.';
  }

  const err = error as { code?: string; message?: string };

  switch (err.code) {
    case '23505':
      return 'Registro duplicado encontrado.';
    case '23503':
      return 'Referência inválida.';
    case '23502':
      return 'Campo obrigatório não preenchido.';
    case '42501':
      return 'Acesso negado.';
    case '42P01':
      return 'Recurso não encontrado.';
    case 'PGRST301':
      return 'Acesso negado.';
    default:
      return 'Operação falhou. Tente novamente.';
  }
}
