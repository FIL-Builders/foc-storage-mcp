/**
 * FOC Storage Tools for Mastra Agent
 * Provides AI-agent-friendly tools for decentralized file storage on Filecoin
 */

// Combined tools array for agent
import { datasetTools } from '@/mastra/tools/dataset-tools';
import { fileTools } from '@/mastra/tools/file-tools';
import { balanceTools } from '@/mastra/tools/balance-tools';
import { paymentTools } from '@/mastra/tools/payment-tools';
import { providerTools } from '@/mastra/tools/provider-tools';

export const focStorageTools = {
  ...datasetTools,
  ...fileTools,
  ...balanceTools,
  ...paymentTools,
  ...providerTools,
};

// Tools array for Mastra Agent
export const focStorageToolsArray = Object.values(focStorageTools);
