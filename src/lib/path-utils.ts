export function getBasePath(): string {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname || '';
    // Case-insensitive match, returning the prefix as it appears in the
    // URL so asset paths stay on whatever casing the page was served under.
    const match = pathname.match(/^\/(semperscribe|naval-letter-formatter)(?=\/|$)/i);
    if (match) {
      return match[0];
    }
  }
  return '';
}

export function resolvePublicPath(url: string): string {
  const basePath = getBasePath();
  if (/^https?:\/\//.test(url)) return url;
  if (basePath) {
    const urlPath = url.startsWith('/') ? url.slice(1) : url;
    return `${basePath}/${urlPath}`;
  }
  return url;
}

