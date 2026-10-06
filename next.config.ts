import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Los viajes antes se llamaban "reservas": los links viejos (notificaciones, emails) siguen funcionando.
  async redirects() {
    return [
      { source: "/app/reservas", destination: "/app/viajes", permanent: true },
      { source: "/app/reservas/:path*", destination: "/app/viajes/:path*", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // Documentos de hasta 100 MB + margen para el multipart.
      bodySizeLimit: "105mb",
    },
  },
};

export default nextConfig;
