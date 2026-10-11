

const nextConfig = {
  turbopack: {},
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }];
  },
  async redirects() {
    return [
      { source: '/dashboard/mypage/:path*', destination: '/dashboard/card/:path*', permanent: true },
      { source: '/@:alias', destination: '/:alias', permanent: true },
    ];
  },
  allowedDevOrigins: ["192.168.18.82"],
};

export default nextConfig;
