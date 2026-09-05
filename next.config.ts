import type {NextConfig} from 'next';
import pkg from './package.json';

// Polyfill Promise.withResolvers for Node.js < 22 (used by react-pdf/pdfjs-dist)
if (!('withResolvers' in Promise)) {
  // @ts-expect-error polyfill
  Promise.withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

const isProd = process.env.NODE_ENV === 'production';
// Deploy target controls the asset basePath.
// 'ghpages' (default): served under /semperscribe on GitHub Pages. The
// prefix must match the repository name's exact case — Pages serves the
// project site at the lowercase canonical URL, and asset requests to a
// differently-cased prefix 404 (page loads unstyled).
// 'cloudgov': served at the route root on cloud.gov, so no basePath.
const deployTarget = process.env.DEPLOY_TARGET ?? 'ghpages';
const basePath = isProd && deployTarget !== 'cloudgov' ? '/semperscribe' : '';

console.log(`[NextConfig] Environment: ${process.env.NODE_ENV}`);
console.log(`[NextConfig] DeployTarget: '${deployTarget}'`);
console.log(`[NextConfig] BasePath: '${basePath}'`);

const nextConfig: NextConfig = {
  // The running version, surfaced in the Privacy and Security Notice so
  // a bug report carries a build identifier. Single source: package.json.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    // The computed base path, inlined at build time so server-rendered
    // HTML and the client agree on asset URLs from the first paint. The
    // .env.production value is superseded by this so the two can never
    // drift when DEPLOY_TARGET changes.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  output: isProd ? 'export' : undefined,
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  compiler: {
    removeConsole: isProd ? { exclude: ['error'] } : false,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
