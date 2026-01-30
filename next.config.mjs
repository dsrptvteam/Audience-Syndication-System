/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize native modules for serverless
      config.externals.push('ssh2', 'ssh2-sftp-client');
    }
    return config;
  },
  // Disable static optimization for API routes with serverless functions
  experimental: {
    serverComponentsExternalPackages: ['ssh2', 'ssh2-sftp-client'],
  },
};

export default nextConfig;
