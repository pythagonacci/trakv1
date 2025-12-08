import { fileURLToPath } from 'url';
import path from 'path';

/** @type {import('next').NextConfig} */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

const nextConfig = {
  // Output standalone build for deployment (only in production)
  ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  
  turbopack: {
    root: projectRoot,
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Matches all Supabase storage URLs
      },
    ],
  },
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;

