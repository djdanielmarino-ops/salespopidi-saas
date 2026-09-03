import { describe, expect, it } from 'vitest';
import { resolveTenantHost } from './tenantHost';

describe('resolveTenantHost', () => {
  it('resolve o slug em um subdominio do dominio configurado', () => {
    expect(resolveTenantHost('acme.app.exemplo.com', 'app.exemplo.com')).toEqual({
      kind: 'tenant', slug: 'acme', source: 'subdomain',
    });
  });

  it('nao interpreta o dominio raiz como empresa', () => {
    expect(resolveTenantHost('app.exemplo.com', 'app.exemplo.com')).toEqual({ kind: 'apex' });
    expect(resolveTenantHost('www.app.exemplo.com', 'app.exemplo.com')).toEqual({ kind: 'apex' });
  });

  it('aceita subdominio localhost para desenvolvimento', () => {
    expect(resolveTenantHost('popidi.localhost')).toEqual({
      kind: 'tenant', slug: 'popidi', source: 'subdomain',
    });
  });

  it('usa override explicito no localhost sem inventar tenant', () => {
    expect(resolveTenantHost('localhost', undefined, 'popidi-dev')).toEqual({
      kind: 'tenant', slug: 'popidi-dev', source: 'development_override',
    });
    expect(resolveTenantHost('localhost')).toEqual({ kind: 'unmanaged' });
  });

  it('rejeita hosts externos, profundos e slugs invalidos', () => {
    expect(resolveTenantHost('preview.vercel.app', 'app.exemplo.com')).toEqual({ kind: 'unmanaged' });
    expect(resolveTenantHost('a.b.app.exemplo.com', 'app.exemplo.com')).toEqual({ kind: 'unmanaged' });
    expect(resolveTenantHost('_admin.app.exemplo.com', 'app.exemplo.com')).toEqual({ kind: 'unmanaged' });
  });
});

