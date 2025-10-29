import type {
    MCPServerResourceContent,
    MCPServerResources,
    Resource,
    ResourceTemplate,
} from "@mastra/mcp";

import { instructions } from "./instructions";

// Resources/resource templates will generally be dynamically fetched.
const myResources: Resource[] = [
    { uri: "file://instructions", name: "Instructions", mimeType: "application/markdown" },
];

const myResourceContents: Record<string, MCPServerResourceContent> = {
    "file://instructions": { text: instructions },
};

const myResourceTemplates: ResourceTemplate[] = [
    {
        uriTemplate: "file://instructions",
        name: "Instructions",
        description: "Instructions for better usage of the tools provided.",
        mimeType: "application/markdown",
    },
];

export const focStorageResources: MCPServerResources = {
    listResources: async () => myResources,
    getResourceContent: async ({ uri }) => {
        if (myResourceContents[uri]) {
            return myResourceContents[uri];
        }
        throw new Error(`Resource content not found for ${uri}`);
    },
    resourceTemplates: async () => myResourceTemplates,
};
