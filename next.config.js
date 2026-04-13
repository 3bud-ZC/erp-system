/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  
  // Optimize for production
  compress: true,
  
  // Image optimization
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', 'chart.js', 'react-chartjs-2'],
  },
  
  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_APP_NAME: 'ERP System',
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
