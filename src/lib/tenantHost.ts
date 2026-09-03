export type TenantHostResolution =
  | { kind: 'tenant'; slug: string; source: 'subdomain' | 'development_override' }
  | { kind: 'apex' }
  | { kind: 'unmanaged' };

const normalizeHostname = (hostname: string) =>
  hostname.trim().toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');

const isIpv4 = (hostname: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

const isValidSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export function resolveTenantHost(
  hostname: string,
  baseDomain?: string,
  developmentSlug?: string,
): TenantHostResolution {
  const host = normalizeHostname(hostname);
  const base = baseDomain ? normalizeHostname(baseDomain) : '';
  const devSlug = developmentSlug?.trim().toLowerCase();

  if ((host === 'localhost' || isIpv4(host) || host.includes(':')) && devSlug) {
    return isValidSlug(devSlug)
      ? { kind: 'tenant', slug: devSlug, source: 'development_override' }
      : { kind: 'unmanaged' };
  }

  if (host.endsWith('.localhost')) {
    const slug = host.slice(0, -'.localhost'.length);
    return isValidSlug(slug) ? { kind: 'tenant', slug, source: 'subdomain' } : { kind: 'unmanaged' };
  }

  if (!base) return { kind: 'unmanaged' };
  if (host === base || host === `www.${base}`) return { kind: 'apex' };

  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return { kind: 'unmanaged' };

  const slug = host.slice(0, -suffix.length);
  return isValidSlug(slug) ? { kind: 'tenant', slug, source: 'subdomain' } : { kind: 'unmanaged' };
}

