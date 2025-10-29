import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/mcp-server.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    shims: true, // Add shims for __dirname, __filename, etc.
    external: [
        // Node.js built-ins
        'fs',
        'path',
        'os',
        'crypto',
        'stream',
        'util',
        'events',
        'buffer',
        'child_process',
        'http',
        'https',
        'net',
        'tls',
        'zlib',
        'url',
        'querystring',

        // Dependencies that should not be bundled
        '@filoz/synapse-sdk',
        'dotenv',

        // Mastra packages (should use from node_modules)
        '@mastra/core',
        '@mastra/mcp',
        '@mastra/libsql',
        '@mastra/loggers',
        '@mastra/memory',

        // AI SDK packages
        '@ai-sdk/openai',
        'ai',

        // Other dependencies
        'ethers',
        'viem',
        'axios',
        'axios-retry',
        'decimal.js',
        'zod',
    ],
    noExternal: [
        // Bundle local modules only
    ],
    onSuccess: 'chmod +x dist/mcp-server.js',
});

