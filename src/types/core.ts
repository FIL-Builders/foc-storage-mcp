/**
 * Core data structures and type definitions for FOC Storage
 * SDK types, interfaces, and data models
 */


export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type McpDatasetPiece = { [key: string]: JsonValue } & {
  id: string;
  url: string;
  metadata: Record<string, JsonValue>;
  cid: string;
};

export type McpDataset = { [key: string]: JsonValue } & {
  pieces: McpDatasetPiece[];
};
