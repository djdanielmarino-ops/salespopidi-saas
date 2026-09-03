export interface BrasilApiCompany {
  razao_social: string;
  nome_fantasia: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
}

export async function fetchCompanyByCnpj(cnpj: string): Promise<BrasilApiCompany | null> {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return null;

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || null,
      cep: data.cep || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      municipio: data.municipio || null,
      uf: data.uf || null,
    };
  } catch {
    return null;
  }
}
