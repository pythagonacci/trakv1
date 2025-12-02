/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone build for deployment (only in production)
  ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  
  // Performance optimizations
  experimental: {
    reactCompiler: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;

