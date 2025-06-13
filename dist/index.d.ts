import { UUID, Plugin } from '@elizaos/core';
import z from 'zod';

declare const ModelConfigSchema: z.ZodObject<{
    EMBEDDING_PROVIDER: z.ZodEnum<["openai", "google"]>;
    TEXT_PROVIDER: z.ZodOptional<z.ZodEnum<["openai", "anthropic", "openrouter", "google"]>>;
    OPENAI_API_KEY: z.ZodOptional<z.ZodString>;
    ANTHROPIC_API_KEY: z.ZodOptional<z.ZodString>;
    OPENROUTER_API_KEY: z.ZodOptional<z.ZodString>;
    GOOGLE_API_KEY: z.ZodOptional<z.ZodString>;
    OPENAI_BASE_URL: z.ZodOptional<z.ZodString>;
    ANTHROPIC_BASE_URL: z.ZodOptional<z.ZodString>;
    OPENROUTER_BASE_URL: z.ZodOptional<z.ZodString>;
    GOOGLE_BASE_URL: z.ZodOptional<z.ZodString>;
    TEXT_EMBEDDING_MODEL: z.ZodString;
    TEXT_MODEL: z.ZodOptional<z.ZodString>;
    MAX_INPUT_TOKENS: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, number, string | number>;
    MAX_OUTPUT_TOKENS: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>, number, string | number | undefined>;
    EMBEDDING_DIMENSION: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>, number, string | number | undefined>;
    CTX_KNOWLEDGE_ENABLED: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    MAX_INPUT_TOKENS: number;
    MAX_OUTPUT_TOKENS: number;
    CTX_KNOWLEDGE_ENABLED: boolean;
    EMBEDDING_PROVIDER: "openai" | "google";
    TEXT_EMBEDDING_MODEL: string;
    EMBEDDING_DIMENSION: number;
    TEXT_PROVIDER?: "openai" | "google" | "anthropic" | "openrouter" | undefined;
    OPENAI_API_KEY?: string | undefined;
    ANTHROPIC_API_KEY?: string | undefined;
    OPENROUTER_API_KEY?: string | undefined;
    GOOGLE_API_KEY?: string | undefined;
    OPENAI_BASE_URL?: string | undefined;
    ANTHROPIC_BASE_URL?: string | undefined;
    OPENROUTER_BASE_URL?: string | undefined;
    GOOGLE_BASE_URL?: string | undefined;
    TEXT_MODEL?: string | undefined;
}, {
    MAX_INPUT_TOKENS: string | number;
    EMBEDDING_PROVIDER: "openai" | "google";
    TEXT_EMBEDDING_MODEL: string;
    MAX_OUTPUT_TOKENS?: string | number | undefined;
    CTX_KNOWLEDGE_ENABLED?: boolean | undefined;
    TEXT_PROVIDER?: "openai" | "google" | "anthropic" | "openrouter" | undefined;
    OPENAI_API_KEY?: string | undefined;
    ANTHROPIC_API_KEY?: string | undefined;
    OPENROUTER_API_KEY?: string | undefined;
    GOOGLE_API_KEY?: string | undefined;
    OPENAI_BASE_URL?: string | undefined;
    ANTHROPIC_BASE_URL?: string | undefined;
    OPENROUTER_BASE_URL?: string | undefined;
    GOOGLE_BASE_URL?: string | undefined;
    TEXT_MODEL?: string | undefined;
    EMBEDDING_DIMENSION?: string | number | undefined;
}>;
type ModelConfig = z.infer<typeof ModelConfigSchema>;
/**
 * Interface for provider rate limits
 */
interface ProviderRateLimits {
    maxConcurrentRequests: number;
    requestsPerMinute: number;
    tokensPerMinute?: number;
    provider: string;
}
/**
 * Options for text generation overrides
 */
interface TextGenerationOptions {
    provider?: 'anthropic' | 'openai' | 'openrouter' | 'google';
    modelName?: string;
    maxTokens?: number;
    /**
     * Document to cache for contextual retrieval.
     * When provided (along with an Anthropic model via OpenRouter), this enables prompt caching.
     * The document is cached with the provider and subsequent requests will reuse the cached document,
     * significantly reducing costs for multiple operations on the same document.
     * Most effective with contextual retrieval for Knowledge applications.
     */
    cacheDocument?: string;
    /**
     * Options for controlling the cache behavior.
     * Currently supports { type: 'ephemeral' } which sets up a temporary cache.
     * Cache expires after approximately 5 minutes with Anthropic models.
     * This can reduce costs by up to 90% for reads after the initial cache write.
     */
    cacheOptions?: {
        type: 'ephemeral';
    };
    /**
     * Whether to automatically detect and enable caching for contextual retrieval.
     * Default is true for OpenRouter+Anthropic models with document-chunk prompts.
     * Set to false to disable automatic caching detection.
     */
    autoCacheContextualRetrieval?: boolean;
}
/**
 * Options for adding knowledge to the system
 */
interface AddKnowledgeOptions {
    worldId: UUID;
    roomId: UUID;
    entityId: UUID;
    /** Client-provided document ID */
    clientDocumentId: UUID;
    /** MIME type of the file */
    contentType: string;
    /** Original filename */
    originalFilename: string;
    /**
     * Content of the document. Should be:
     * - Base64 encoded string for binary files (PDFs, DOCXs, etc)
     * - Plain text for text files
     */
    content: string;
    /**
     * Optional metadata to associate with the knowledge
     * Used for storing additional information like source URL
     */
    metadata?: Record<string, unknown>;
}
declare module '@elizaos/core' {
    interface ServiceTypeRegistry {
        KNOWLEDGE: 'knowledge';
    }
}
declare const KnowledgeServiceType: {
    KNOWLEDGE: "knowledge";
};
interface KnowledgeDocumentMetadata extends Record<string, any> {
    type: string;
    source: string;
    title?: string;
    filename?: string;
    fileExt?: string;
    fileType?: string;
    fileSize?: number;
    url?: string;
    timestamp: number;
    documentId?: string;
}
interface KnowledgeConfig {
    CTX_KNOWLEDGE_ENABLED: boolean;
    LOAD_DOCS_ON_STARTUP: boolean;
    MAX_INPUT_TOKENS?: string | number;
    MAX_OUTPUT_TOKENS?: string | number;
    EMBEDDING_PROVIDER?: string;
    TEXT_PROVIDER?: string;
    TEXT_EMBEDDING_MODEL?: string;
}
interface LoadResult {
    successful: number;
    failed: number;
    errors?: Array<{
        filename: string;
        error: string;
    }>;
}
/**
 * Extends the base MemoryMetadata from @elizaos/core with additional fields
 */
interface ExtendedMemoryMetadata extends Record<string, any> {
    type?: string;
    title?: string;
    filename?: string;
    path?: string;
    description?: string;
    fileExt?: string;
    timestamp?: number;
    contentType?: string;
    documentId?: string;
    source?: string;
    fileType?: string;
    fileSize?: number;
    position?: number;
    originalFilename?: string;
    url?: string;
}

/**
 * Knowledge Plugin - Main Entry Point
 *
 * This file exports all the necessary functions and types for the Knowledge plugin.
 */

/**
 * Knowledge Plugin - Provides Retrieval Augmented Generation capabilities
 */
declare const knowledgePlugin: Plugin;

export { type AddKnowledgeOptions, type ExtendedMemoryMetadata, type KnowledgeConfig, type KnowledgeDocumentMetadata, KnowledgeServiceType, type LoadResult, type ModelConfig, ModelConfigSchema, type ProviderRateLimits, type TextGenerationOptions, knowledgePlugin as default, knowledgePlugin };
