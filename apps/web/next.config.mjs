/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Los paquetes del monorepo se publican como TypeScript compilado; no hace
  // falta transpilarlos aquí.
  experimental: {},
};

export default nextConfig;
