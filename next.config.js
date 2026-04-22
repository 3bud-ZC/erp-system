const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  
  // Use standalone output to avoid static generation issues
  output: 'standalone',
  
  // Optimize for production
  compress: true,
  
  // Image optimization
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
    unoptimized: true,
  },
  
  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', 'chart.js', 'react-chartjs-2'],
  },
  
  // Environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_APP_NAME: 'ERP System',
  },
  
  // Webpack configuration - Critical for Vercel path resolution
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
    
    // Critical: Use absolute paths for aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/components': path.resolve(__dirname, 'components'),
      '@/app': path.resolve(__dirname, 'app'),
    };
    
    return config;
  },
  
  // ESLint warnings allowed but errors will not block build
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
