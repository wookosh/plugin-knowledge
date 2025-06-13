import {
  convertPdfToTextFromBuffer,
  extractTextFromFileBuffer,
  fetchUrlContent,
  isBinaryContentType,
  loadDocsFromPath,
  normalizeS3Url
} from "./chunk-MFXNKYBS.js";

// src/index.ts
import { logger as logger6 } from "@elizaos/core";

// src/types.ts
import z from "zod";
var ModelConfigSchema = z.object({
  // Provider configuration
  // NOTE: If EMBEDDING_PROVIDER is not specified, the plugin automatically assumes
  // plugin-openai is being used and will use OPENAI_EMBEDDING_MODEL and
  // OPENAI_EMBEDDING_DIMENSIONS for configuration
  EMBEDDING_PROVIDER: z.enum(["openai", "google"]),
  TEXT_PROVIDER: z.enum(["openai", "anthropic", "openrouter", "google"]).optional(),
  // API keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  // Base URLs (optional for most providers)
  OPENAI_BASE_URL: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().optional(),
  GOOGLE_BASE_URL: z.string().optional(),
  // Model names
  TEXT_EMBEDDING_MODEL: z.string(),
  TEXT_MODEL: z.string().optional(),
  // Token limits
  MAX_INPUT_TOKENS: z.string().or(z.number()).transform((val) => typeof val === "string" ? parseInt(val, 10) : val),
  MAX_OUTPUT_TOKENS: z.string().or(z.number()).optional().transform((val) => val ? typeof val === "string" ? parseInt(val, 10) : val : 4096),
  // Embedding dimension
  // For OpenAI: Only applies to text-embedding-3-small and text-embedding-3-large models
  // Default: 1536 dimensions
  EMBEDDING_DIMENSION: z.string().or(z.number()).optional().transform((val) => val ? typeof val === "string" ? parseInt(val, 10) : val : 1536),
  // Contextual Knowledge settings
  CTX_KNOWLEDGE_ENABLED: z.boolean().default(false)
});
var KnowledgeServiceType = {
  KNOWLEDGE: "knowledge"
};

// src/config.ts
import z2 from "zod";
import { logger } from "@elizaos/core";
function validateModelConfig(runtime) {
  try {
    const getSetting = (key, defaultValue) => {
      if (runtime) {
        return runtime.getSetting(key) || defaultValue;
      }
      return process.env[key] || defaultValue;
    };
    const ctxKnowledgeEnabled2 = getSetting("CTX_KNOWLEDGE_ENABLED") === "true";
    logger.debug(`Configuration: CTX_KNOWLEDGE_ENABLED=${ctxKnowledgeEnabled2}`);
    const embeddingProvider = getSetting("EMBEDDING_PROVIDER");
    const assumePluginOpenAI = !embeddingProvider;
    if (assumePluginOpenAI) {
      const openaiApiKey2 = getSetting("OPENAI_API_KEY");
      const openaiEmbeddingModel = getSetting("OPENAI_EMBEDDING_MODEL");
      if (openaiApiKey2 && openaiEmbeddingModel) {
        logger.info("EMBEDDING_PROVIDER not specified, using configuration from plugin-openai");
      } else {
        logger.warn(
          "EMBEDDING_PROVIDER not specified, but plugin-openai configuration incomplete. Check OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL."
        );
      }
    }
    const finalEmbeddingProvider = embeddingProvider || "openai";
    const textEmbeddingModel = getSetting("TEXT_EMBEDDING_MODEL") || getSetting("OPENAI_EMBEDDING_MODEL") || "text-embedding-3-small";
    const embeddingDimension = getSetting("EMBEDDING_DIMENSION") || getSetting("OPENAI_EMBEDDING_DIMENSIONS") || "1536";
    const openaiApiKey = getSetting("OPENAI_API_KEY");
    const config = ModelConfigSchema.parse({
      EMBEDDING_PROVIDER: finalEmbeddingProvider,
      TEXT_PROVIDER: getSetting("TEXT_PROVIDER"),
      OPENAI_API_KEY: openaiApiKey,
      ANTHROPIC_API_KEY: getSetting("ANTHROPIC_API_KEY"),
      OPENROUTER_API_KEY: getSetting("OPENROUTER_API_KEY"),
      GOOGLE_API_KEY: getSetting("GOOGLE_API_KEY"),
      OPENAI_BASE_URL: getSetting("OPENAI_BASE_URL"),
      ANTHROPIC_BASE_URL: getSetting("ANTHROPIC_BASE_URL"),
      OPENROUTER_BASE_URL: getSetting("OPENROUTER_BASE_URL"),
      GOOGLE_BASE_URL: getSetting("GOOGLE_BASE_URL"),
      TEXT_EMBEDDING_MODEL: textEmbeddingModel,
      TEXT_MODEL: getSetting("TEXT_MODEL"),
      MAX_INPUT_TOKENS: getSetting("MAX_INPUT_TOKENS", "4000"),
      MAX_OUTPUT_TOKENS: getSetting("MAX_OUTPUT_TOKENS", "4096"),
      EMBEDDING_DIMENSION: embeddingDimension,
      CTX_KNOWLEDGE_ENABLED: ctxKnowledgeEnabled2
    });
    validateConfigRequirements(config, assumePluginOpenAI);
    return config;
  } catch (error) {
    if (error instanceof z2.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      throw new Error(`Model configuration validation failed: ${issues}`);
    }
    throw error;
  }
}
function validateConfigRequirements(config, assumePluginOpenAI) {
  if (!assumePluginOpenAI) {
    if (config.EMBEDDING_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when EMBEDDING_PROVIDER is set to "openai"');
    }
    if (config.EMBEDDING_PROVIDER === "google" && !config.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required when EMBEDDING_PROVIDER is set to "google"');
    }
  } else {
    if (!config.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required when using plugin-openai configuration");
    }
    if (!config.TEXT_EMBEDDING_MODEL) {
      throw new Error("OPENAI_EMBEDDING_MODEL is required when using plugin-openai configuration");
    }
  }
  if (config.CTX_KNOWLEDGE_ENABLED) {
    logger.info("Contextual Knowledge is enabled. Validating text generation settings...");
    if (config.TEXT_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when TEXT_PROVIDER is set to "openai"');
    }
    if (config.TEXT_PROVIDER === "anthropic" && !config.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required when TEXT_PROVIDER is set to "anthropic"');
    }
    if (config.TEXT_PROVIDER === "openrouter" && !config.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is required when TEXT_PROVIDER is set to "openrouter"');
    }
    if (config.TEXT_PROVIDER === "google" && !config.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required when TEXT_PROVIDER is set to "google"');
    }
    if (config.TEXT_PROVIDER === "openrouter") {
      const modelName = config.TEXT_MODEL?.toLowerCase() || "";
      if (modelName.includes("claude") || modelName.includes("gemini")) {
        logger.info(
          `Using ${modelName} with OpenRouter. This configuration supports document caching for improved performance.`
        );
      }
    }
  } else {
    if (assumePluginOpenAI) {
      logger.info(
        "Contextual Knowledge is disabled. Using embedding configuration from plugin-openai."
      );
    } else {
      logger.info("Contextual Knowledge is disabled. Using basic embedding-only configuration.");
    }
  }
}
async function getProviderRateLimits(runtime) {
  const config = validateModelConfig(runtime);
  const getSetting = (key, defaultValue) => {
    if (runtime) {
      return runtime.getSetting(key) || defaultValue;
    }
    return process.env[key] || defaultValue;
  };
  const maxConcurrentRequests = parseInt(getSetting("MAX_CONCURRENT_REQUESTS", "30"), 10);
  const requestsPerMinute = parseInt(getSetting("REQUESTS_PER_MINUTE", "60"), 10);
  const tokensPerMinute = parseInt(getSetting("TOKENS_PER_MINUTE", "150000"), 10);
  switch (config.EMBEDDING_PROVIDER) {
    case "openai":
      return {
        maxConcurrentRequests,
        requestsPerMinute: Math.min(requestsPerMinute, 3e3),
        tokensPerMinute: Math.min(tokensPerMinute, 15e4),
        provider: "openai"
      };
    case "google":
      return {
        maxConcurrentRequests,
        requestsPerMinute: Math.min(requestsPerMinute, 60),
        tokensPerMinute: Math.min(tokensPerMinute, 1e5),
        provider: "google"
      };
    default:
      return {
        maxConcurrentRequests,
        requestsPerMinute,
        tokensPerMinute,
        provider: config.EMBEDDING_PROVIDER
      };
  }
}

// src/service.ts
import {
  createUniqueUuid,
  logger as logger3,
  MemoryType as MemoryType2,
  ModelType as ModelType2,
  Semaphore,
  Service,
  splitChunks as splitChunks2
} from "@elizaos/core";

// src/document-processor.ts
import {
  MemoryType,
  ModelType,
  logger as logger2,
  splitChunks
} from "@elizaos/core";

// node_modules/uuid/dist/esm/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/esm/rng.js
import { randomFillSync } from "crypto";
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist/esm/native.js
import { randomUUID } from "crypto";
var native_default = { randomUUID };

// node_modules/uuid/dist/esm/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/ctx-embeddings.ts
var DEFAULT_CHUNK_TOKEN_SIZE = 500;
var DEFAULT_CHUNK_OVERLAP_TOKENS = 100;
var DEFAULT_CHARS_PER_TOKEN = 3.5;
var CONTEXT_TARGETS = {
  DEFAULT: {
    MIN_TOKENS: 60,
    MAX_TOKENS: 120
  },
  PDF: {
    MIN_TOKENS: 80,
    MAX_TOKENS: 150
  },
  MATH_PDF: {
    MIN_TOKENS: 100,
    MAX_TOKENS: 180
  },
  CODE: {
    MIN_TOKENS: 100,
    MAX_TOKENS: 200
  },
  TECHNICAL: {
    MIN_TOKENS: 80,
    MAX_TOKENS: 160
  }
};
var SYSTEM_PROMPTS = {
  DEFAULT: "You are a precision text augmentation tool. Your task is to expand a given text chunk with its direct context from a larger document. You must: 1) Keep the original chunk intact; 2) Add critical context from surrounding text; 3) Never summarize or rephrase the original chunk; 4) Create contextually rich output for improved semantic retrieval.",
  CODE: "You are a precision code augmentation tool. Your task is to expand a given code chunk with necessary context from the larger codebase. You must: 1) Keep the original code chunk intact with exact syntax and indentation; 2) Add relevant imports, function signatures, or class definitions; 3) Include critical surrounding code context; 4) Create contextually rich output that maintains correct syntax.",
  PDF: "You are a precision document augmentation tool. Your task is to expand a given PDF text chunk with its direct context from the larger document. You must: 1) Keep the original chunk intact; 2) Add section headings, references, or figure captions; 3) Include text that immediately precedes and follows the chunk; 4) Create contextually rich output that maintains the document's original structure.",
  MATH_PDF: "You are a precision mathematical content augmentation tool. Your task is to expand a given mathematical text chunk with essential context. You must: 1) Keep original mathematical notations and expressions exactly as they appear; 2) Add relevant definitions, theorems, or equations from elsewhere in the document; 3) Preserve all LaTeX or mathematical formatting; 4) Create contextually rich output for improved mathematical comprehension.",
  TECHNICAL: "You are a precision technical documentation augmentation tool. Your task is to expand a technical document chunk with critical context. You must: 1) Keep the original chunk intact including all technical terminology; 2) Add relevant configuration examples, parameter definitions, or API references; 3) Include any prerequisite information; 4) Create contextually rich output that maintains technical accuracy."
};
var CONTEXTUAL_CHUNK_ENRICHMENT_PROMPT_TEMPLATE = `
<document>
{doc_content}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this chunk by adding critical surrounding context. Follow these guidelines:

1. Identify the document's main topic and key information relevant to understanding this chunk
2. Include 2-3 sentences before the chunk that provide essential context
3. Include 2-3 sentences after the chunk that complete thoughts or provide resolution
4. For technical documents, include any definitions or explanations of terms used in the chunk
5. For narrative content, include character or setting information needed to understand the chunk
6. Keep the original chunk text COMPLETELY INTACT and UNCHANGED in your response
7. Do not use phrases like "this chunk discusses" - directly present the context
8. The total length should be between {min_tokens} and {max_tokens} tokens
9. Format the response as a single coherent paragraph

Provide ONLY the enriched chunk text in your response:`;
var CACHED_CHUNK_PROMPT_TEMPLATE = `
Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this chunk by adding critical surrounding context. Follow these guidelines:

1. Identify the document's main topic and key information relevant to understanding this chunk
2. Include 2-3 sentences before the chunk that provide essential context
3. Include 2-3 sentences after the chunk that complete thoughts or provide resolution
4. For technical documents, include any definitions or explanations of terms used in the chunk
5. For narrative content, include character or setting information needed to understand the chunk
6. Keep the original chunk text COMPLETELY INTACT and UNCHANGED in your response
7. Do not use phrases like "this chunk discusses" - directly present the context
8. The total length should be between {min_tokens} and {max_tokens} tokens
9. Format the response as a single coherent paragraph

Provide ONLY the enriched chunk text in your response:`;
var CACHED_CODE_CHUNK_PROMPT_TEMPLATE = `
Here is the chunk of code we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this code chunk by adding critical surrounding context. Follow these guidelines:

1. Preserve ALL code syntax, indentation, and comments exactly as they appear
2. Include any import statements, function definitions, or class declarations that this code depends on
3. Add necessary type definitions or interfaces that are referenced in this chunk
4. Include any crucial comments from elsewhere in the document that explain this code
5. If there are key variable declarations or initializations earlier in the document, include those
6. Keep the original chunk COMPLETELY INTACT and UNCHANGED in your response
7. The total length should be between {min_tokens} and {max_tokens} tokens
8. Do NOT include implementation details for functions that are only called but not defined in this chunk

Provide ONLY the enriched code chunk in your response:`;
var CACHED_MATH_PDF_PROMPT_TEMPLATE = `
Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this chunk by adding critical surrounding context. This document contains mathematical content that requires special handling. Follow these guidelines:

1. Preserve ALL mathematical notation exactly as it appears in the chunk
2. Include any defining equations, variables, or parameters mentioned earlier in the document that relate to this chunk
3. Add section/subsection names or figure references if they help situate the chunk
4. If variables or symbols are defined elsewhere in the document, include these definitions
5. If mathematical expressions appear corrupted, try to infer their meaning from context
6. Keep the original chunk text COMPLETELY INTACT and UNCHANGED in your response
7. The total length should be between {min_tokens} and {max_tokens} tokens
8. Format the response as a coherent mathematical explanation

Provide ONLY the enriched chunk text in your response:`;
var CACHED_TECHNICAL_PROMPT_TEMPLATE = `
Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this chunk by adding critical surrounding context. This appears to be technical documentation that requires special handling. Follow these guidelines:

1. Preserve ALL technical terminology, product names, and version numbers exactly as they appear
2. Include any prerequisite information or requirements mentioned earlier in the document
3. Add section/subsection headings or navigation path to situate this chunk within the document structure
4. Include any definitions of technical terms, acronyms, or jargon used in this chunk
5. If this chunk references specific configurations, include relevant parameter explanations
6. Keep the original chunk text COMPLETELY INTACT and UNCHANGED in your response
7. The total length should be between {min_tokens} and {max_tokens} tokens
8. Format the response maintaining any hierarchical structure present in the original

Provide ONLY the enriched chunk text in your response:`;
var MATH_PDF_PROMPT_TEMPLATE = `
<document>
{doc_content}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this chunk by adding critical surrounding context. This document contains mathematical content that requires special handling. Follow these guidelines:

1. Preserve ALL mathematical notation exactly as it appears in the chunk
2. Include any defining equations, variables, or parameters mentioned earlier in the document that relate to this chunk
3. Add section/subsection names or figure references if they help situate the chunk
4. If variables or symbols are defined elsewhere in the document, include these definitions
5. If mathematical expressions appear corrupted, try to infer their meaning from context
6. Keep the original chunk text COMPLETELY INTACT and UNCHANGED in your response
7. The total length should be between {min_tokens} and {max_tokens} tokens
8. Format the response as a coherent mathematical explanation

Provide ONLY the enriched chunk text in your response:`;
var CODE_PROMPT_TEMPLATE = `
<document>
{doc_content}
</document>

Here is the chunk of code we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this code chunk by adding critical surrounding context. Follow these guidelines:

1. Preserve ALL code syntax, indentation, and comments exactly as they appear
2. Include any import statements, function definitions, or class declarations that this code depends on
3. Add necessary type definitions or interfaces that are referenced in this chunk
4. Include any crucial comments from elsewhere in the document that explain this code
5. If there are key variable declarations or initializations earlier in the document, include those
6. Keep the original chunk COMPLETELY INTACT and UNCHANGED in your response
7. The total length should be between {min_tokens} and {max_tokens} tokens
8. Do NOT include implementation details for functions that are only called but not defined in this chunk

Provide ONLY the enriched code chunk in your response:`;
var TECHNICAL_PROMPT_TEMPLATE = `
<document>
{doc_content}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk_content}
</chunk>

Create an enriched version of this chunk by adding critical surrounding context. This appears to be technical documentation that requires special handling. Follow these guidelines:

1. Preserve ALL technical terminology, product names, and version numbers exactly as they appear
2. Include any prerequisite information or requirements mentioned earlier in the document
3. Add section/subsection headings or navigation path to situate this chunk within the document structure
4. Include any definitions of technical terms, acronyms, or jargon used in this chunk
5. If this chunk references specific configurations, include relevant parameter explanations
6. Keep the original chunk text COMPLETELY INTACT and UNCHANGED in your response
7. The total length should be between {min_tokens} and {max_tokens} tokens
8. Format the response maintaining any hierarchical structure present in the original

Provide ONLY the enriched chunk text in your response:`;
function getContextualizationPrompt(docContent, chunkContent, minTokens = CONTEXT_TARGETS.DEFAULT.MIN_TOKENS, maxTokens = CONTEXT_TARGETS.DEFAULT.MAX_TOKENS, promptTemplate = CONTEXTUAL_CHUNK_ENRICHMENT_PROMPT_TEMPLATE) {
  if (!docContent || !chunkContent) {
    console.warn(
      "Document content or chunk content is missing for contextualization."
    );
    return "Error: Document or chunk content missing.";
  }
  const chunkTokens = Math.ceil(chunkContent.length / DEFAULT_CHARS_PER_TOKEN);
  if (chunkTokens > maxTokens * 0.7) {
    maxTokens = Math.ceil(chunkTokens * 1.3);
    minTokens = chunkTokens;
  }
  return promptTemplate.replace("{doc_content}", docContent).replace("{chunk_content}", chunkContent).replace("{min_tokens}", minTokens.toString()).replace("{max_tokens}", maxTokens.toString());
}
function getCachingContextualizationPrompt(chunkContent, contentType, minTokens = CONTEXT_TARGETS.DEFAULT.MIN_TOKENS, maxTokens = CONTEXT_TARGETS.DEFAULT.MAX_TOKENS) {
  if (!chunkContent) {
    console.warn("Chunk content is missing for contextualization.");
    return {
      prompt: "Error: Chunk content missing.",
      systemPrompt: SYSTEM_PROMPTS.DEFAULT
    };
  }
  const chunkTokens = Math.ceil(chunkContent.length / DEFAULT_CHARS_PER_TOKEN);
  if (chunkTokens > maxTokens * 0.7) {
    maxTokens = Math.ceil(chunkTokens * 1.3);
    minTokens = chunkTokens;
  }
  let promptTemplate = CACHED_CHUNK_PROMPT_TEMPLATE;
  let systemPrompt = SYSTEM_PROMPTS.DEFAULT;
  if (contentType) {
    if (contentType.includes("javascript") || contentType.includes("typescript") || contentType.includes("python") || contentType.includes("java") || contentType.includes("c++") || contentType.includes("code")) {
      promptTemplate = CACHED_CODE_CHUNK_PROMPT_TEMPLATE;
      systemPrompt = SYSTEM_PROMPTS.CODE;
    } else if (contentType.includes("pdf")) {
      if (containsMathematicalContent(chunkContent)) {
        promptTemplate = CACHED_MATH_PDF_PROMPT_TEMPLATE;
        systemPrompt = SYSTEM_PROMPTS.MATH_PDF;
      } else {
        systemPrompt = SYSTEM_PROMPTS.PDF;
      }
    } else if (contentType.includes("markdown") || contentType.includes("text/html") || isTechnicalDocumentation(chunkContent)) {
      promptTemplate = CACHED_TECHNICAL_PROMPT_TEMPLATE;
      systemPrompt = SYSTEM_PROMPTS.TECHNICAL;
    }
  }
  const formattedPrompt = promptTemplate.replace("{chunk_content}", chunkContent).replace("{min_tokens}", minTokens.toString()).replace("{max_tokens}", maxTokens.toString());
  return {
    prompt: formattedPrompt,
    systemPrompt
  };
}
function getPromptForMimeType(mimeType, docContent, chunkContent) {
  let minTokens = CONTEXT_TARGETS.DEFAULT.MIN_TOKENS;
  let maxTokens = CONTEXT_TARGETS.DEFAULT.MAX_TOKENS;
  let promptTemplate = CONTEXTUAL_CHUNK_ENRICHMENT_PROMPT_TEMPLATE;
  if (mimeType.includes("pdf")) {
    if (containsMathematicalContent(docContent)) {
      minTokens = CONTEXT_TARGETS.MATH_PDF.MIN_TOKENS;
      maxTokens = CONTEXT_TARGETS.MATH_PDF.MAX_TOKENS;
      promptTemplate = MATH_PDF_PROMPT_TEMPLATE;
      console.debug("Using mathematical PDF prompt template");
    } else {
      minTokens = CONTEXT_TARGETS.PDF.MIN_TOKENS;
      maxTokens = CONTEXT_TARGETS.PDF.MAX_TOKENS;
      console.debug("Using standard PDF settings");
    }
  } else if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("python") || mimeType.includes("java") || mimeType.includes("c++") || mimeType.includes("code")) {
    minTokens = CONTEXT_TARGETS.CODE.MIN_TOKENS;
    maxTokens = CONTEXT_TARGETS.CODE.MAX_TOKENS;
    promptTemplate = CODE_PROMPT_TEMPLATE;
    console.debug("Using code prompt template");
  } else if (isTechnicalDocumentation(docContent) || mimeType.includes("markdown") || mimeType.includes("text/html")) {
    minTokens = CONTEXT_TARGETS.TECHNICAL.MIN_TOKENS;
    maxTokens = CONTEXT_TARGETS.TECHNICAL.MAX_TOKENS;
    promptTemplate = TECHNICAL_PROMPT_TEMPLATE;
    console.debug("Using technical documentation prompt template");
  }
  return getContextualizationPrompt(
    docContent,
    chunkContent,
    minTokens,
    maxTokens,
    promptTemplate
  );
}
function getCachingPromptForMimeType(mimeType, chunkContent) {
  let minTokens = CONTEXT_TARGETS.DEFAULT.MIN_TOKENS;
  let maxTokens = CONTEXT_TARGETS.DEFAULT.MAX_TOKENS;
  if (mimeType.includes("pdf")) {
    if (containsMathematicalContent(chunkContent)) {
      minTokens = CONTEXT_TARGETS.MATH_PDF.MIN_TOKENS;
      maxTokens = CONTEXT_TARGETS.MATH_PDF.MAX_TOKENS;
    } else {
      minTokens = CONTEXT_TARGETS.PDF.MIN_TOKENS;
      maxTokens = CONTEXT_TARGETS.PDF.MAX_TOKENS;
    }
  } else if (mimeType.includes("javascript") || mimeType.includes("typescript") || mimeType.includes("python") || mimeType.includes("java") || mimeType.includes("c++") || mimeType.includes("code")) {
    minTokens = CONTEXT_TARGETS.CODE.MIN_TOKENS;
    maxTokens = CONTEXT_TARGETS.CODE.MAX_TOKENS;
  } else if (isTechnicalDocumentation(chunkContent) || mimeType.includes("markdown") || mimeType.includes("text/html")) {
    minTokens = CONTEXT_TARGETS.TECHNICAL.MIN_TOKENS;
    maxTokens = CONTEXT_TARGETS.TECHNICAL.MAX_TOKENS;
  }
  return getCachingContextualizationPrompt(
    chunkContent,
    mimeType,
    minTokens,
    maxTokens
  );
}
function containsMathematicalContent(content) {
  const latexMathPatterns = [
    /\$\$.+?\$\$/s,
    // Display math: $$ ... $$
    /\$.+?\$/g,
    // Inline math: $ ... $
    /\\begin\{equation\}/,
    // LaTeX equation environment
    /\\begin\{align\}/,
    // LaTeX align environment
    /\\sum_/,
    // Summation
    /\\int/,
    // Integral
    /\\frac\{/,
    // Fraction
    /\\sqrt\{/,
    // Square root
    /\\alpha|\\beta|\\gamma|\\delta|\\theta|\\lambda|\\sigma/,
    // Greek letters
    /\\nabla|\\partial/
    // Differential operators
  ];
  const generalMathPatterns = [
    /[≠≤≥±∞∫∂∑∏√∈∉⊆⊇⊂⊃∪∩]/,
    // Mathematical symbols
    /\b[a-zA-Z]\^[0-9]/,
    // Simple exponents (e.g., x^2)
    /\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)/,
    // Coordinates
    /\b[xyz]\s*=\s*-?\d+(\.\d+)?/,
    // Simple equations
    /\[\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\]/,
    // Vectors/matrices
    /\b\d+\s*×\s*\d+/
    // Dimensions with × symbol
  ];
  for (const pattern of latexMathPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }
  for (const pattern of generalMathPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }
  const mathKeywords = [
    "theorem",
    "lemma",
    "proof",
    "equation",
    "function",
    "derivative",
    "integral",
    "matrix",
    "vector",
    "algorithm",
    "constraint",
    "coefficient"
  ];
  const contentLower = content.toLowerCase();
  const mathKeywordCount = mathKeywords.filter(
    (keyword) => contentLower.includes(keyword)
  ).length;
  return mathKeywordCount >= 2;
}
function isTechnicalDocumentation(content) {
  const technicalPatterns = [
    /\b(version|v)\s*\d+\.\d+(\.\d+)?/i,
    // Version numbers
    /\b(api|sdk|cli)\b/i,
    // Technical acronyms
    /\b(http|https|ftp):\/\//i,
    // URLs
    /\b(GET|POST|PUT|DELETE)\b/,
    // HTTP methods
    /<\/?[a-z][\s\S]*>/i,
    // HTML/XML tags
    /\bREADME\b|\bCHANGELOG\b/i,
    // Common doc file names
    /\b(config|configuration)\b/i,
    // Configuration references
    /\b(parameter|param|argument|arg)\b/i
    // Parameter references
  ];
  const docHeadings = [
    /\b(Introduction|Overview|Getting Started|Installation|Usage|API Reference|Troubleshooting)\b/i
  ];
  for (const pattern of [...technicalPatterns, ...docHeadings]) {
    if (pattern.test(content)) {
      return true;
    }
  }
  const listPatterns = [
    /\d+\.\s.+\n\d+\.\s.+/,
    // Numbered lists
    /•\s.+\n•\s.+/,
    // Bullet points with •
    /\*\s.+\n\*\s.+/,
    // Bullet points with *
    /-\s.+\n-\s.+/
    // Bullet points with -
  ];
  for (const pattern of listPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }
  return false;
}
function getChunkWithContext(chunkContent, generatedContext) {
  if (!generatedContext || generatedContext.trim() === "") {
    console.warn(
      "Generated context is empty. Falling back to original chunk content."
    );
    return chunkContent;
  }
  if (!generatedContext.includes(chunkContent)) {
    console.warn(
      "Generated context does not contain the original chunk. Appending original to ensure data integrity."
    );
    return `${generatedContext.trim()}

${chunkContent}`;
  }
  return generatedContext.trim();
}

// src/document-processor.ts
var ctxKnowledgeEnabled = process.env.CTX_KNOWLEDGE_ENABLED === "true" || process.env.CTX_KNOWLEDGE_ENABLED === "True";
if (ctxKnowledgeEnabled) {
  logger2.info(`Document processor starting with Contextual Knowledge ENABLED`);
} else {
  logger2.info(`Document processor starting with Contextual Knowledge DISABLED`);
}
async function processFragmentsSynchronously({
  runtime,
  documentId,
  fullDocumentText,
  agentId,
  contentType,
  roomId,
  entityId,
  worldId
}) {
  if (!fullDocumentText || fullDocumentText.trim() === "") {
    logger2.warn(`No text content available to chunk for document ${documentId}.`);
    return 0;
  }
  const chunks = await splitDocumentIntoChunks(fullDocumentText);
  if (chunks.length === 0) {
    logger2.warn(`No chunks generated from text for ${documentId}. No fragments to save.`);
    return 0;
  }
  logger2.info(`Split content into ${chunks.length} chunks for document ${documentId}`);
  const providerLimits = await getProviderRateLimits();
  const CONCURRENCY_LIMIT = Math.min(30, providerLimits.maxConcurrentRequests || 30);
  const rateLimiter = createRateLimiter(providerLimits.requestsPerMinute || 60);
  const { savedCount, failedCount } = await processAndSaveFragments({
    runtime,
    documentId,
    chunks,
    fullDocumentText,
    contentType,
    agentId,
    roomId: roomId || agentId,
    entityId: entityId || agentId,
    worldId: worldId || agentId,
    concurrencyLimit: CONCURRENCY_LIMIT,
    rateLimiter
  });
  if (failedCount > 0) {
    logger2.warn(
      `Failed to process ${failedCount} chunks out of ${chunks.length} for document ${documentId}`
    );
  }
  logger2.info(`Finished saving ${savedCount} fragments for document ${documentId}.`);
  return savedCount;
}
async function extractTextFromDocument(fileBuffer, contentType, originalFilename) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error(`Empty file buffer provided for ${originalFilename}. Cannot extract text.`);
  }
  try {
    if (contentType === "application/pdf") {
      logger2.debug(`Extracting text from PDF: ${originalFilename}`);
      return await convertPdfToTextFromBuffer(fileBuffer, originalFilename);
    } else {
      logger2.debug(`Extracting text from non-PDF: ${originalFilename} (Type: ${contentType})`);
      if (contentType.includes("text/") || contentType.includes("application/json") || contentType.includes("application/xml")) {
        try {
          return fileBuffer.toString("utf8");
        } catch (textError) {
          logger2.warn(
            `Failed to decode ${originalFilename} as UTF-8, falling back to binary extraction`
          );
        }
      }
      return await extractTextFromFileBuffer(fileBuffer, contentType, originalFilename);
    }
  } catch (error) {
    logger2.error(`Error extracting text from ${originalFilename}: ${error.message}`);
    throw new Error(`Failed to extract text from ${originalFilename}: ${error.message}`);
  }
}
function createDocumentMemory({
  text,
  agentId,
  clientDocumentId,
  originalFilename,
  contentType,
  worldId,
  fileSize,
  documentId,
  customMetadata
}) {
  const fileExt = originalFilename.split(".").pop()?.toLowerCase() || "";
  const title = originalFilename.replace(`.${fileExt}`, "");
  const docId = documentId || v4_default();
  return {
    id: docId,
    agentId,
    roomId: agentId,
    worldId,
    entityId: agentId,
    content: { text },
    metadata: {
      type: MemoryType.DOCUMENT,
      documentId: clientDocumentId,
      originalFilename,
      contentType,
      title,
      fileExt,
      fileSize,
      source: "rag-service-main-upload",
      timestamp: Date.now(),
      // Merge custom metadata if provided
      ...customMetadata || {}
    }
  };
}
async function splitDocumentIntoChunks(documentText) {
  const tokenChunkSize = DEFAULT_CHUNK_TOKEN_SIZE;
  const tokenChunkOverlap = DEFAULT_CHUNK_OVERLAP_TOKENS;
  const targetCharChunkSize = Math.round(tokenChunkSize * DEFAULT_CHARS_PER_TOKEN);
  const targetCharChunkOverlap = Math.round(tokenChunkOverlap * DEFAULT_CHARS_PER_TOKEN);
  logger2.debug(
    `Using core splitChunks with settings: tokenChunkSize=${tokenChunkSize}, tokenChunkOverlap=${tokenChunkOverlap}, charChunkSize=${targetCharChunkSize}, charChunkOverlap=${targetCharChunkOverlap}`
  );
  return await splitChunks(documentText, tokenChunkSize, tokenChunkOverlap);
}
async function processAndSaveFragments({
  runtime,
  documentId,
  chunks,
  fullDocumentText,
  contentType,
  agentId,
  roomId,
  entityId,
  worldId,
  concurrencyLimit,
  rateLimiter
}) {
  let savedCount = 0;
  let failedCount = 0;
  const failedChunks = [];
  for (let i = 0; i < chunks.length; i += concurrencyLimit) {
    const batchChunks = chunks.slice(i, i + concurrencyLimit);
    const batchOriginalIndices = Array.from({ length: batchChunks.length }, (_, k) => i + k);
    logger2.debug(
      `Processing batch of ${batchChunks.length} chunks for document ${documentId}. Starting original index: ${batchOriginalIndices[0]}, batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(chunks.length / concurrencyLimit)}`
    );
    const contextualizedChunks = await getContextualizedChunks(
      runtime,
      fullDocumentText,
      batchChunks,
      contentType,
      batchOriginalIndices
    );
    const embeddingResults = await generateEmbeddingsForChunks(
      runtime,
      contextualizedChunks,
      rateLimiter
    );
    for (const result of embeddingResults) {
      const originalChunkIndex = result.index;
      if (!result.success) {
        failedCount++;
        failedChunks.push(originalChunkIndex);
        logger2.warn(`Failed to process chunk ${originalChunkIndex} for document ${documentId}`);
        continue;
      }
      const contextualizedChunkText = result.text;
      const embedding = result.embedding;
      if (!embedding || embedding.length === 0) {
        logger2.warn(
          `Zero vector detected for chunk ${originalChunkIndex} (document ${documentId}). Embedding: ${JSON.stringify(result.embedding)}`
        );
        failedCount++;
        failedChunks.push(originalChunkIndex);
        continue;
      }
      try {
        const fragmentMemory = {
          id: v4_default(),
          agentId,
          roomId: roomId || agentId,
          worldId: worldId || agentId,
          entityId: entityId || agentId,
          embedding,
          content: { text: contextualizedChunkText },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId,
            position: originalChunkIndex,
            timestamp: Date.now(),
            source: "rag-service-fragment-sync"
          }
        };
        await runtime.createMemory(fragmentMemory, "knowledge");
        logger2.debug(
          `Saved fragment ${originalChunkIndex + 1} for document ${documentId} (Fragment ID: ${fragmentMemory.id})`
        );
        savedCount++;
      } catch (saveError) {
        logger2.error(
          `Error saving chunk ${originalChunkIndex} to database: ${saveError.message}`,
          saveError.stack
        );
        failedCount++;
        failedChunks.push(originalChunkIndex);
      }
    }
    if (i + concurrencyLimit < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return { savedCount, failedCount, failedChunks };
}
async function generateEmbeddingsForChunks(runtime, contextualizedChunks, rateLimiter) {
  return await Promise.all(
    contextualizedChunks.map(async (contextualizedChunk) => {
      await rateLimiter();
      try {
        const generateEmbeddingOperation = async () => {
          return await generateEmbeddingWithValidation(
            runtime,
            contextualizedChunk.contextualizedText
          );
        };
        const { embedding, success, error } = await withRateLimitRetry(
          generateEmbeddingOperation,
          `embedding generation for chunk ${contextualizedChunk.index}`
        );
        if (!success) {
          return {
            success: false,
            index: contextualizedChunk.index,
            error,
            text: contextualizedChunk.contextualizedText
          };
        }
        return {
          embedding,
          success: true,
          index: contextualizedChunk.index,
          text: contextualizedChunk.contextualizedText
        };
      } catch (error) {
        logger2.error(
          `Error generating embedding for chunk ${contextualizedChunk.index}: ${error.message}`
        );
        return {
          success: false,
          index: contextualizedChunk.index,
          error,
          text: contextualizedChunk.contextualizedText
        };
      }
    })
  );
}
async function getContextualizedChunks(runtime, fullDocumentText, chunks, contentType, batchOriginalIndices) {
  if (ctxKnowledgeEnabled && fullDocumentText) {
    logger2.debug(`Generating contexts for ${chunks.length} chunks`);
    return await generateContextsInBatch(
      runtime,
      fullDocumentText,
      chunks,
      contentType,
      batchOriginalIndices
    );
  } else {
    return chunks.map((chunkText, idx) => ({
      contextualizedText: chunkText,
      index: batchOriginalIndices[idx],
      success: true
    }));
  }
}
async function generateContextsInBatch(runtime, fullDocumentText, chunks, contentType, batchIndices) {
  if (!chunks || chunks.length === 0) {
    return [];
  }
  const providerLimits = await getProviderRateLimits();
  const rateLimiter = createRateLimiter(providerLimits.requestsPerMinute || 60);
  const config = validateModelConfig();
  const isUsingOpenRouter = config.TEXT_PROVIDER === "openrouter";
  const isUsingCacheCapableModel = isUsingOpenRouter && (config.TEXT_MODEL?.toLowerCase().includes("claude") || config.TEXT_MODEL?.toLowerCase().includes("gemini"));
  const promptConfigs = prepareContextPrompts(
    chunks,
    fullDocumentText,
    contentType,
    batchIndices,
    isUsingCacheCapableModel
  );
  const contextualizedChunks = await Promise.all(
    promptConfigs.map(async (item) => {
      if (!item.valid) {
        return {
          contextualizedText: item.chunkText,
          success: false,
          index: item.originalIndex
        };
      }
      await rateLimiter();
      try {
        let llmResponse;
        const generateTextOperation = async () => {
          if (item.usesCaching) {
            return await runtime.useModel(ModelType.TEXT_LARGE, {
              prompt: item.promptText,
              system: item.systemPrompt
              // cacheDocument: item.fullDocumentTextForContext, // Not directly supported by useModel
              // cacheOptions: { type: 'ephemeral' }, // Not directly supported by useModel
            });
          } else {
            return await runtime.useModel(ModelType.TEXT_LARGE, {
              prompt: item.prompt
            });
          }
        };
        llmResponse = await withRateLimitRetry(
          generateTextOperation,
          `context generation for chunk ${item.originalIndex}`
        );
        const generatedContext = llmResponse.text;
        const contextualizedText = getChunkWithContext(item.chunkText, generatedContext);
        logger2.debug(
          `Context added for chunk ${item.originalIndex}. New length: ${contextualizedText.length}`
        );
        return {
          contextualizedText,
          success: true,
          index: item.originalIndex
        };
      } catch (error) {
        logger2.error(
          `Error generating context for chunk ${item.originalIndex}: ${error.message}`,
          error.stack
        );
        return {
          contextualizedText: item.chunkText,
          success: false,
          index: item.originalIndex
        };
      }
    })
  );
  return contextualizedChunks;
}
function prepareContextPrompts(chunks, fullDocumentText, contentType, batchIndices, isUsingCacheCapableModel = false) {
  return chunks.map((chunkText, idx) => {
    const originalIndex = batchIndices ? batchIndices[idx] : idx;
    try {
      if (isUsingCacheCapableModel) {
        const cachingPromptInfo = contentType ? getCachingPromptForMimeType(contentType, chunkText) : getCachingContextualizationPrompt(chunkText);
        if (cachingPromptInfo.prompt.startsWith("Error:")) {
          logger2.warn(
            `Skipping contextualization for chunk ${originalIndex} due to: ${cachingPromptInfo.prompt}`
          );
          return {
            originalIndex,
            chunkText,
            valid: false,
            usesCaching: false
          };
        }
        return {
          valid: true,
          originalIndex,
          chunkText,
          usesCaching: true,
          systemPrompt: cachingPromptInfo.systemPrompt,
          promptText: cachingPromptInfo.prompt,
          fullDocumentTextForContext: fullDocumentText
        };
      } else {
        const prompt = contentType ? getPromptForMimeType(contentType, fullDocumentText, chunkText) : getContextualizationPrompt(fullDocumentText, chunkText);
        if (prompt.startsWith("Error:")) {
          logger2.warn(`Skipping contextualization for chunk ${originalIndex} due to: ${prompt}`);
          return {
            prompt: null,
            originalIndex,
            chunkText,
            valid: false,
            usesCaching: false
          };
        }
        return {
          prompt,
          originalIndex,
          chunkText,
          valid: true,
          usesCaching: false
        };
      }
    } catch (error) {
      logger2.error(
        `Error preparing prompt for chunk ${originalIndex}: ${error.message}`,
        error.stack
      );
      return {
        prompt: null,
        originalIndex,
        chunkText,
        valid: false,
        usesCaching: false
      };
    }
  });
}
async function generateEmbeddingWithValidation(runtime, text) {
  try {
    const embeddingResult = await runtime.useModel(ModelType.TEXT_EMBEDDING, {
      text
    });
    const embedding = Array.isArray(embeddingResult) ? embeddingResult : embeddingResult?.embedding;
    if (!embedding || embedding.length === 0) {
      logger2.warn(`Zero vector detected. Embedding result: ${JSON.stringify(embeddingResult)}`);
      return {
        embedding: null,
        success: false,
        error: new Error("Zero vector detected")
      };
    }
    return { embedding, success: true };
  } catch (error) {
    return { embedding: null, success: false, error };
  }
}
async function withRateLimitRetry(operation, errorContext, retryDelay) {
  try {
    return await operation();
  } catch (error) {
    if (error.status === 429) {
      const delay = retryDelay || error.headers?.["retry-after"] || 5;
      logger2.warn(`Rate limit hit for ${errorContext}. Retrying after ${delay}s`);
      await new Promise((resolve) => setTimeout(resolve, delay * 1e3));
      try {
        return await operation();
      } catch (retryError) {
        logger2.error(`Failed after retry for ${errorContext}: ${retryError.message}`);
        throw retryError;
      }
    }
    throw error;
  }
}
function createRateLimiter(requestsPerMinute) {
  const requestTimes = [];
  const intervalMs = 60 * 1e3;
  return async function rateLimiter() {
    const now = Date.now();
    while (requestTimes.length > 0 && now - requestTimes[0] > intervalMs) {
      requestTimes.shift();
    }
    if (requestTimes.length >= requestsPerMinute) {
      const oldestRequest = requestTimes[0];
      const timeToWait = Math.max(0, oldestRequest + intervalMs - now);
      if (timeToWait > 0) {
        logger2.debug(`Rate limiting applied, waiting ${timeToWait}ms before next request`);
        await new Promise((resolve) => setTimeout(resolve, timeToWait));
      }
    }
    requestTimes.push(Date.now());
  };
}

// src/service.ts
var KnowledgeService = class _KnowledgeService extends Service {
  static serviceType = "knowledge";
  config;
  knowledgeConfig;
  capabilityDescription = "Provides Retrieval Augmented Generation capabilities, including knowledge upload and querying.";
  knowledgeProcessingSemaphore;
  /**
   * Create a new Knowledge service
   * @param runtime Agent runtime
   */
  constructor(runtime, config) {
    super(runtime);
    this.knowledgeProcessingSemaphore = new Semaphore(10);
    const parseBooleanEnv = (value) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.toLowerCase() === "true";
      return false;
    };
    this.knowledgeConfig = {
      CTX_KNOWLEDGE_ENABLED: parseBooleanEnv(config?.CTX_KNOWLEDGE_ENABLED),
      LOAD_DOCS_ON_STARTUP: parseBooleanEnv(config?.LOAD_DOCS_ON_STARTUP),
      MAX_INPUT_TOKENS: config?.MAX_INPUT_TOKENS,
      MAX_OUTPUT_TOKENS: config?.MAX_OUTPUT_TOKENS,
      EMBEDDING_PROVIDER: config?.EMBEDDING_PROVIDER,
      TEXT_PROVIDER: config?.TEXT_PROVIDER,
      TEXT_EMBEDDING_MODEL: config?.TEXT_EMBEDDING_MODEL
    };
    this.config = { ...this.knowledgeConfig };
    logger3.info(
      `KnowledgeService initialized for agent ${this.runtime.agentId} with config:`,
      this.knowledgeConfig
    );
    if (this.knowledgeConfig.LOAD_DOCS_ON_STARTUP) {
      this.loadInitialDocuments().catch((error) => {
        logger3.error("Error during initial document loading in KnowledgeService:", error);
      });
    }
  }
  async loadInitialDocuments() {
    logger3.info(
      `KnowledgeService: Checking for documents to load on startup for agent ${this.runtime.agentId}`
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const result = await loadDocsFromPath(this, this.runtime.agentId);
      if (result.successful > 0) {
        logger3.info(
          `KnowledgeService: Loaded ${result.successful} documents from docs folder on startup for agent ${this.runtime.agentId}`
        );
      } else {
        logger3.info(
          `KnowledgeService: No new documents found to load on startup for agent ${this.runtime.agentId}`
        );
      }
    } catch (error) {
      logger3.error(
        `KnowledgeService: Error loading documents on startup for agent ${this.runtime.agentId}:`,
        error
      );
    }
  }
  /**
   * Start the Knowledge service
   * @param runtime Agent runtime
   * @returns Initialized Knowledge service
   */
  static async start(runtime) {
    logger3.info(`Starting Knowledge service for agent: ${runtime.agentId}`);
    const service = new _KnowledgeService(runtime);
    if (service.runtime.character?.knowledge && service.runtime.character.knowledge.length > 0) {
      logger3.info(
        `KnowledgeService: Processing ${service.runtime.character.knowledge.length} character knowledge items.`
      );
      const stringKnowledge = service.runtime.character.knowledge.filter(
        (item) => typeof item === "string"
      );
      await service.processCharacterKnowledge(stringKnowledge).catch((err) => {
        logger3.error(
          `KnowledgeService: Error processing character knowledge during startup: ${err.message}`,
          err
        );
      });
    } else {
      logger3.info(
        `KnowledgeService: No character knowledge to process for agent ${runtime.agentId}.`
      );
    }
    return service;
  }
  /**
   * Stop the Knowledge service
   * @param runtime Agent runtime
   */
  static async stop(runtime) {
    logger3.info(`Stopping Knowledge service for agent: ${runtime.agentId}`);
    const service = runtime.getService(_KnowledgeService.serviceType);
    if (!service) {
      logger3.warn(`KnowledgeService not found for agent ${runtime.agentId} during stop.`);
    }
    if (service instanceof _KnowledgeService) {
      await service.stop();
    }
  }
  /**
   * Stop the service
   */
  async stop() {
    logger3.info(`Knowledge service stopping for agent: ${this.runtime.agentId}`);
  }
  /**
   * Add knowledge to the system
   * @param options Knowledge options
   * @returns Promise with document processing result
   */
  async addKnowledge(options) {
    const agentId = this.runtime.agentId;
    logger3.info(
      `KnowledgeService (agent: ${agentId}) processing document for public addKnowledge: ${options.originalFilename}, type: ${options.contentType}`
    );
    try {
      const existingDocument = await this.runtime.getMemoryById(options.clientDocumentId);
      if (existingDocument && existingDocument.metadata?.type === MemoryType2.DOCUMENT) {
        logger3.info(
          `Document ${options.originalFilename} with ID ${options.clientDocumentId} already exists. Skipping processing.`
        );
        const fragments = await this.runtime.getMemories({
          tableName: "knowledge"
          // Assuming fragments store original documentId in metadata.documentId
          // This query might need adjustment based on actual fragment metadata structure.
          // A more robust way would be to query where metadata.documentId === options.clientDocumentId
        });
        const relatedFragments = fragments.filter(
          (f) => f.metadata?.type === MemoryType2.FRAGMENT && f.metadata.documentId === options.clientDocumentId
        );
        return {
          clientDocumentId: options.clientDocumentId,
          storedDocumentMemoryId: existingDocument.id,
          fragmentCount: relatedFragments.length
        };
      }
    } catch (error) {
      logger3.debug(
        `Document ${options.clientDocumentId} not found or error checking existence, proceeding with processing: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return this.processDocument(options);
  }
  /**
   * Process a document regardless of type - Called by public addKnowledge
   * @param options Document options
   * @returns Promise with document processing result
   */
  async processDocument({
    clientDocumentId,
    contentType,
    originalFilename,
    worldId,
    content,
    roomId,
    entityId,
    metadata
  }) {
    const agentId = this.runtime.agentId;
    try {
      logger3.debug(
        `KnowledgeService: Processing document ${originalFilename} (type: ${contentType}) via processDocument`
      );
      let fileBuffer = null;
      let extractedText;
      let documentContentToStore;
      const isPdfFile = contentType === "application/pdf" || originalFilename.toLowerCase().endsWith(".pdf");
      if (isPdfFile) {
        try {
          fileBuffer = Buffer.from(content, "base64");
        } catch (e) {
          logger3.error(
            `KnowledgeService: Failed to convert base64 to buffer for ${originalFilename}: ${e.message}`
          );
          throw new Error(`Invalid base64 content for PDF file ${originalFilename}`);
        }
        extractedText = await extractTextFromDocument(fileBuffer, contentType, originalFilename);
        documentContentToStore = content;
      } else if (isBinaryContentType(contentType, originalFilename)) {
        try {
          fileBuffer = Buffer.from(content, "base64");
        } catch (e) {
          logger3.error(
            `KnowledgeService: Failed to convert base64 to buffer for ${originalFilename}: ${e.message}`
          );
          throw new Error(`Invalid base64 content for binary file ${originalFilename}`);
        }
        extractedText = await extractTextFromDocument(fileBuffer, contentType, originalFilename);
        documentContentToStore = extractedText;
      } else {
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        const looksLikeBase64 = content && content.length > 0 && base64Regex.test(content.replace(/\s/g, ""));
        if (looksLikeBase64) {
          try {
            const decodedBuffer = Buffer.from(content, "base64");
            const decodedText = decodedBuffer.toString("utf8");
            const invalidCharCount = (decodedText.match(/\ufffd/g) || []).length;
            const textLength = decodedText.length;
            if (invalidCharCount > 0 && invalidCharCount / textLength > 0.1) {
              throw new Error("Decoded content contains too many invalid characters");
            }
            logger3.debug(`Successfully decoded base64 content for text file: ${originalFilename}`);
            extractedText = decodedText;
            documentContentToStore = decodedText;
          } catch (e) {
            logger3.error(
              `Failed to decode base64 for ${originalFilename}: ${e instanceof Error ? e.message : String(e)}`
            );
            throw new Error(
              `File ${originalFilename} appears to be corrupted or incorrectly encoded`
            );
          }
        } else {
          logger3.debug(`Treating content as plain text for file: ${originalFilename}`);
          extractedText = content;
          documentContentToStore = content;
        }
      }
      if (!extractedText || extractedText.trim() === "") {
        const noTextError = new Error(
          `KnowledgeService: No text content extracted from ${originalFilename} (type: ${contentType}).`
        );
        logger3.warn(noTextError.message);
        throw noTextError;
      }
      const documentMemory = createDocumentMemory({
        text: documentContentToStore,
        // Store base64 only for PDFs, plain text for everything else
        agentId,
        clientDocumentId,
        // This becomes the memory.id
        originalFilename,
        contentType,
        worldId,
        fileSize: fileBuffer ? fileBuffer.length : extractedText.length,
        documentId: clientDocumentId,
        // Explicitly set documentId in metadata as well
        customMetadata: metadata
        // Pass the custom metadata
      });
      const memoryWithScope = {
        ...documentMemory,
        id: clientDocumentId,
        // Ensure the ID of the memory is the clientDocumentId
        agentId,
        roomId: roomId || agentId,
        entityId: entityId || agentId
      };
      logger3.debug(
        `KnowledgeService: Creating memory with agentId=${agentId}, entityId=${entityId}, roomId=${roomId}, this.runtime.agentId=${this.runtime.agentId}`
      );
      logger3.debug(
        `KnowledgeService: memoryWithScope agentId=${memoryWithScope.agentId}, entityId=${memoryWithScope.entityId}`
      );
      await this.runtime.createMemory(memoryWithScope, "documents");
      logger3.debug(
        `KnowledgeService: Stored document ${originalFilename} (Memory ID: ${memoryWithScope.id})`
      );
      const fragmentCount = await processFragmentsSynchronously({
        runtime: this.runtime,
        documentId: clientDocumentId,
        // Pass clientDocumentId to link fragments
        fullDocumentText: extractedText,
        agentId,
        contentType,
        roomId: roomId || agentId,
        entityId: entityId || agentId,
        worldId: worldId || agentId
      });
      logger3.info(
        `KnowledgeService: Document ${originalFilename} processed with ${fragmentCount} fragments for agent ${agentId}`
      );
      return {
        clientDocumentId,
        storedDocumentMemoryId: memoryWithScope.id,
        fragmentCount
      };
    } catch (error) {
      logger3.error(
        `KnowledgeService: Error processing document ${originalFilename}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
  // --- Knowledge methods moved from AgentRuntime ---
  async handleProcessingError(error, context) {
    logger3.error(`KnowledgeService: Error ${context}:`, error?.message || error || "Unknown error");
    throw error;
  }
  async checkExistingKnowledge(knowledgeId) {
    const existingDocument = await this.runtime.getMemoryById(knowledgeId);
    return !!existingDocument;
  }
  async getKnowledge(message, scope) {
    logger3.debug("KnowledgeService: getKnowledge called for message id: " + message.id);
    if (!message?.content?.text || message?.content?.text.trim().length === 0) {
      logger3.warn("KnowledgeService: Invalid or empty message content for knowledge query.");
      return [];
    }
    const embedding = await this.runtime.useModel(ModelType2.TEXT_EMBEDDING, {
      text: message.content.text
    });
    const filterScope = {};
    if (scope?.roomId) filterScope.roomId = scope.roomId;
    if (scope?.worldId) filterScope.worldId = scope.worldId;
    if (scope?.entityId) filterScope.entityId = scope.entityId;
    const fragments = await this.runtime.searchMemories({
      tableName: "knowledge",
      embedding,
      query: message.content.text,
      ...filterScope,
      count: 20,
      match_threshold: 0.1
      // TODO: Make configurable
    });
    return fragments.filter((fragment) => fragment.id !== void 0).map((fragment) => ({
      id: fragment.id,
      // Cast as UUID after filtering
      content: fragment.content,
      // Cast if necessary, ensure Content type matches
      similarity: fragment.similarity,
      metadata: fragment.metadata,
      worldId: fragment.worldId
    }));
  }
  async processCharacterKnowledge(items) {
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    logger3.info(
      `KnowledgeService: Processing ${items.length} character knowledge items for agent ${this.runtime.agentId}`
    );
    const processingPromises = items.map(async (item) => {
      await this.knowledgeProcessingSemaphore.acquire();
      try {
        const knowledgeId = createUniqueUuid(this.runtime.agentId + item, item);
        if (await this.checkExistingKnowledge(knowledgeId)) {
          logger3.debug(
            `KnowledgeService: Character knowledge item with ID ${knowledgeId} already exists. Skipping.`
          );
          return;
        }
        logger3.debug(
          `KnowledgeService: Processing character knowledge for ${this.runtime.character?.name} - ${item.slice(0, 100)}`
        );
        let metadata = {
          type: MemoryType2.DOCUMENT,
          // Character knowledge often represents a doc/fact.
          timestamp: Date.now(),
          source: "character"
          // Indicate the source
        };
        const pathMatch = item.match(/^Path: (.+?)(?:\n|\r\n)/);
        if (pathMatch) {
          const filePath = pathMatch[1].trim();
          const extension = filePath.split(".").pop() || "";
          const filename = filePath.split("/").pop() || "";
          const title = filename.replace(`.${extension}`, "");
          metadata = {
            ...metadata,
            path: filePath,
            filename,
            fileExt: extension,
            title,
            fileType: `text/${extension || "plain"}`,
            // Assume text if not specified
            fileSize: item.length
          };
        }
        await this._internalAddKnowledge(
          {
            id: knowledgeId,
            // Use the content-derived ID
            content: {
              text: item
            },
            metadata
          },
          void 0,
          {
            // Scope to the agent itself for character knowledge
            roomId: this.runtime.agentId,
            entityId: this.runtime.agentId,
            worldId: this.runtime.agentId
          }
        );
      } catch (error) {
        await this.handleProcessingError(error, "processing character knowledge");
      } finally {
        this.knowledgeProcessingSemaphore.release();
      }
    });
    await Promise.all(processingPromises);
    logger3.info(
      `KnowledgeService: Finished processing character knowledge for agent ${this.runtime.agentId}.`
    );
  }
  async _internalAddKnowledge(item, options = {
    targetTokens: 1500,
    // TODO: Make these configurable, perhaps from plugin config
    overlap: 200,
    modelContextSize: 4096
  }, scope = {
    // Default scope for internal additions (like character knowledge)
    roomId: this.runtime.agentId,
    entityId: this.runtime.agentId,
    worldId: this.runtime.agentId
  }) {
    const finalScope = {
      roomId: scope?.roomId ?? this.runtime.agentId,
      worldId: scope?.worldId ?? this.runtime.agentId,
      entityId: scope?.entityId ?? this.runtime.agentId
    };
    logger3.debug(`KnowledgeService: _internalAddKnowledge called for item ID ${item.id}`);
    const documentMemory = {
      id: item.id,
      // This ID should be the unique ID for the document being added.
      agentId: this.runtime.agentId,
      roomId: finalScope.roomId,
      worldId: finalScope.worldId,
      entityId: finalScope.entityId,
      content: item.content,
      metadata: {
        ...item.metadata || {},
        // Spread existing metadata
        type: MemoryType2.DOCUMENT,
        // Ensure it's marked as a document
        documentId: item.id,
        // Ensure metadata.documentId is set to the item's ID
        timestamp: item.metadata?.timestamp || Date.now()
      },
      createdAt: Date.now()
    };
    const existingDocument = await this.runtime.getMemoryById(item.id);
    if (existingDocument) {
      logger3.debug(
        `KnowledgeService: Document ${item.id} already exists in _internalAddKnowledge, updating...`
      );
      await this.runtime.updateMemory({
        ...documentMemory,
        id: item.id
        // Ensure ID is passed for update
      });
    } else {
      await this.runtime.createMemory(documentMemory, "documents");
    }
    const fragments = await this.splitAndCreateFragments(
      item,
      // item.id is the documentId
      options.targetTokens,
      options.overlap,
      finalScope
    );
    let fragmentsProcessed = 0;
    for (const fragment of fragments) {
      try {
        await this.processDocumentFragment(fragment);
        fragmentsProcessed++;
      } catch (error) {
        logger3.error(
          `KnowledgeService: Error processing fragment ${fragment.id} for document ${item.id}:`,
          error
        );
      }
    }
    logger3.debug(
      `KnowledgeService: Processed ${fragmentsProcessed}/${fragments.length} fragments for document ${item.id}.`
    );
  }
  async processDocumentFragment(fragment) {
    try {
      await this.runtime.addEmbeddingToMemory(fragment);
      await this.runtime.createMemory(fragment, "knowledge");
    } catch (error) {
      logger3.error(
        `KnowledgeService: Error processing fragment ${fragment.id}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }
  async splitAndCreateFragments(document, targetTokens, overlap, scope) {
    if (!document.content.text) {
      return [];
    }
    const text = document.content.text;
    const chunks = await splitChunks2(text, targetTokens, overlap);
    return chunks.map((chunk, index) => {
      const fragmentIdContent = `${document.id}-fragment-${index}-${Date.now()}`;
      const fragmentId = createUniqueUuid(
        this.runtime.agentId + fragmentIdContent,
        fragmentIdContent
      );
      return {
        id: fragmentId,
        entityId: scope.entityId,
        agentId: this.runtime.agentId,
        roomId: scope.roomId,
        worldId: scope.worldId,
        content: {
          text: chunk
        },
        metadata: {
          ...document.metadata || {},
          // Spread metadata from parent document
          type: MemoryType2.FRAGMENT,
          documentId: document.id,
          // Link fragment to parent document
          position: index,
          timestamp: Date.now()
          // Fragment's own creation timestamp
          // Ensure we don't overwrite essential fragment metadata with document's
          // For example, source might be different or more specific for the fragment.
          // Here, we primarily inherit and then set fragment-specifics.
        },
        createdAt: Date.now()
      };
    });
  }
  // ADDED METHODS START
  /**
   * Retrieves memories, typically documents, for the agent.
   * Corresponds to GET /plugins/knowledge/documents
   */
  async getMemories(params) {
    return this.runtime.getMemories({
      ...params
      // includes tableName, roomId, count, end
    });
  }
  /**
   * Deletes a specific memory item (knowledge document) by its ID.
   * Corresponds to DELETE /plugins/knowledge/documents/:knowledgeId
   * Assumes the memoryId corresponds to an item in the 'documents' table or that
   * runtime.deleteMemory can correctly identify it.
   */
  async deleteMemory(memoryId) {
    await this.runtime.deleteMemory(memoryId);
    logger3.info(
      `KnowledgeService: Deleted memory ${memoryId} for agent ${this.runtime.agentId}. Assumed it was a document or related fragment.`
    );
  }
  // ADDED METHODS END
};

// src/provider.ts
import { addHeader } from "@elizaos/core";
var knowledgeProvider = {
  name: "KNOWLEDGE",
  description: "Knowledge from the knowledge base that the agent knows, retrieved whenever the agent needs to answer a question about their expertise.",
  dynamic: true,
  get: async (runtime, message) => {
    const knowledgeData = await runtime.getService("knowledge")?.getKnowledge(message);
    const firstFiveKnowledgeItems = knowledgeData?.slice(0, 5);
    let knowledge = (firstFiveKnowledgeItems && firstFiveKnowledgeItems.length > 0 ? addHeader(
      "# Knowledge",
      firstFiveKnowledgeItems.map((knowledge2) => `- ${knowledge2.content.text}`).join("\n")
    ) : "") + "\n";
    const tokenLength = 3.5;
    if (knowledge.length > 4e3 * tokenLength) {
      knowledge = knowledge.slice(0, 4e3 * tokenLength);
    }
    return {
      data: {
        knowledge
      },
      values: {
        knowledge
      },
      text: knowledge
    };
  }
};

// src/tests.ts
import { MemoryType as MemoryType3, ModelType as ModelType3 } from "@elizaos/core";
import { Buffer as Buffer2 } from "buffer";
import * as fs from "fs";
import * as path from "path";
var mockLogger = {
  info: (() => {
    const fn = (...args) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn;
  })(),
  warn: (() => {
    const fn = (...args) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn;
  })(),
  error: (() => {
    const fn = (...args) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn;
  })(),
  debug: (() => {
    const fn = (...args) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn;
  })(),
  success: (() => {
    const fn = (...args) => {
      fn.calls.push(args);
    };
    fn.calls = [];
    return fn;
  })(),
  clearCalls: () => {
    mockLogger.info.calls = [];
    mockLogger.warn.calls = [];
    mockLogger.error.calls = [];
    mockLogger.debug.calls = [];
    mockLogger.success.calls = [];
  }
};
global.logger = mockLogger;
function createMockRuntime(overrides) {
  const memories = /* @__PURE__ */ new Map();
  const services = /* @__PURE__ */ new Map();
  return {
    agentId: v4_default(),
    character: {
      name: "Test Agent",
      bio: ["Test bio"],
      knowledge: []
    },
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    services,
    events: /* @__PURE__ */ new Map(),
    // Database methods
    async init() {
    },
    async close() {
    },
    async getConnection() {
      return null;
    },
    async getAgent(agentId) {
      return null;
    },
    async getAgents() {
      return [];
    },
    async createAgent(agent) {
      return true;
    },
    async updateAgent(agentId, agent) {
      return true;
    },
    async deleteAgent(agentId) {
      return true;
    },
    async ensureAgentExists(agent) {
      return agent;
    },
    async ensureEmbeddingDimension(dimension) {
    },
    async getEntityById(entityId) {
      return null;
    },
    async getEntitiesForRoom(roomId) {
      return [];
    },
    async createEntity(entity) {
      return true;
    },
    async updateEntity(entity) {
    },
    async getComponent(entityId, type) {
      return null;
    },
    async getComponents(entityId) {
      return [];
    },
    async createComponent(component) {
      return true;
    },
    async updateComponent(component) {
    },
    async deleteComponent(componentId) {
    },
    // Memory methods with mock implementation
    async getMemoryById(id) {
      return memories.get(id) || null;
    },
    async getMemories(params) {
      const results = Array.from(memories.values()).filter((m) => {
        if (params.roomId && m.roomId !== params.roomId) return false;
        if (params.entityId && m.entityId !== params.entityId) return false;
        if (params.tableName === "knowledge" && m.metadata?.type !== MemoryType3.FRAGMENT)
          return false;
        if (params.tableName === "documents" && m.metadata?.type !== MemoryType3.DOCUMENT)
          return false;
        return true;
      });
      return params.count ? results.slice(0, params.count) : results;
    },
    async getMemoriesByIds(ids) {
      return ids.map((id) => memories.get(id)).filter(Boolean);
    },
    async getMemoriesByRoomIds(params) {
      return Array.from(memories.values()).filter(
        (m) => params.roomIds.includes(m.roomId)
      );
    },
    async searchMemories(params) {
      const fragments = Array.from(memories.values()).filter(
        (m) => m.metadata?.type === MemoryType3.FRAGMENT
      );
      return fragments.map((f) => ({
        ...f,
        similarity: 0.8 + Math.random() * 0.2
        // Mock similarity between 0.8 and 1.0
      })).slice(0, params.count || 10);
    },
    async createMemory(memory, tableName) {
      const id = memory.id || v4_default();
      const memoryWithId = { ...memory, id };
      memories.set(id, memoryWithId);
      return id;
    },
    async updateMemory(memory) {
      if (memory.id && memories.has(memory.id)) {
        memories.set(memory.id, { ...memories.get(memory.id), ...memory });
        return true;
      }
      return false;
    },
    async deleteMemory(memoryId) {
      memories.delete(memoryId);
    },
    async deleteAllMemories(roomId, tableName) {
      for (const [id, memory] of memories.entries()) {
        if (memory.roomId === roomId) {
          memories.delete(id);
        }
      }
    },
    async countMemories(roomId) {
      return Array.from(memories.values()).filter((m) => m.roomId === roomId).length;
    },
    // Other required methods with minimal implementation
    async getCachedEmbeddings(params) {
      return [];
    },
    async log(params) {
    },
    async getLogs(params) {
      return [];
    },
    async deleteLog(logId) {
    },
    async createWorld(world) {
      return v4_default();
    },
    async getWorld(id) {
      return null;
    },
    async removeWorld(id) {
    },
    async getAllWorlds() {
      return [];
    },
    async updateWorld(world) {
    },
    async getRoom(roomId) {
      return null;
    },
    async createRoom(room) {
      return v4_default();
    },
    async deleteRoom(roomId) {
    },
    async deleteRoomsByWorldId(worldId) {
    },
    async updateRoom(room) {
    },
    async getRoomsForParticipant(entityId) {
      return [];
    },
    async getRoomsForParticipants(userIds) {
      return [];
    },
    async getRooms(worldId) {
      return [];
    },
    async addParticipant(entityId, roomId) {
      return true;
    },
    async removeParticipant(entityId, roomId) {
      return true;
    },
    async getParticipantsForEntity(entityId) {
      return [];
    },
    async getParticipantsForRoom(roomId) {
      return [];
    },
    async getParticipantUserState(roomId, entityId) {
      return null;
    },
    async setParticipantUserState(roomId, entityId, state) {
    },
    async createRelationship(params) {
      return true;
    },
    async updateRelationship(relationship) {
    },
    async getRelationship(params) {
      return null;
    },
    async getRelationships(params) {
      return [];
    },
    async getCache(key) {
      return void 0;
    },
    async setCache(key, value) {
      return true;
    },
    async deleteCache(key) {
      return true;
    },
    async createTask(task) {
      return v4_default();
    },
    async getTasks(params) {
      return [];
    },
    async getTask(id) {
      return null;
    },
    async getTasksByName(name) {
      return [];
    },
    async updateTask(id, task) {
    },
    async deleteTask(id) {
    },
    async getMemoriesByWorldId(params) {
      return [];
    },
    // Plugin/service methods
    async registerPlugin(plugin) {
    },
    async initialize() {
    },
    getService(name) {
      return services.get(name) || null;
    },
    getAllServices() {
      return services;
    },
    async registerService(ServiceClass) {
      const service = await ServiceClass.start(this);
      services.set(ServiceClass.serviceType, service);
    },
    registerDatabaseAdapter(adapter) {
    },
    setSetting(key, value) {
    },
    getSetting(key) {
      return null;
    },
    getConversationLength() {
      return 0;
    },
    async processActions(message, responses) {
    },
    async evaluate(message) {
      return null;
    },
    registerProvider(provider) {
      this.providers.push(provider);
    },
    registerAction(action) {
    },
    registerEvaluator(evaluator) {
    },
    async ensureConnection(params) {
    },
    async ensureParticipantInRoom(entityId, roomId) {
    },
    async ensureWorldExists(world) {
    },
    async ensureRoomExists(room) {
    },
    async composeState(message) {
      return {
        values: {},
        data: {},
        text: ""
      };
    },
    // Model methods with mocks
    async useModel(modelType, params) {
      if (modelType === ModelType3.TEXT_EMBEDDING) {
        return new Array(1536).fill(0).map(() => Math.random());
      }
      if (modelType === ModelType3.TEXT_LARGE || modelType === ModelType3.TEXT_SMALL) {
        return `Mock response for: ${params.prompt}`;
      }
      return null;
    },
    registerModel(modelType, handler, provider) {
    },
    getModel(modelType) {
      return void 0;
    },
    registerEvent(event, handler) {
    },
    getEvent(event) {
      return void 0;
    },
    async emitEvent(event, params) {
    },
    registerTaskWorker(taskHandler) {
    },
    getTaskWorker(name) {
      return void 0;
    },
    async stop() {
    },
    async addEmbeddingToMemory(memory) {
      memory.embedding = await this.useModel(ModelType3.TEXT_EMBEDDING, {
        text: memory.content.text
      });
      return memory;
    },
    registerSendHandler(source, handler) {
    },
    async sendMessageToTarget(target, content) {
    },
    ...overrides
  };
}
function createTestFileBuffer(content, type = "text") {
  if (type === "pdf") {
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${content.length + 10} >>
stream
BT /F1 12 Tf 100 700 Td (${content}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000362 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${465 + content.length}
%%EOF`;
    return Buffer2.from(pdfContent);
  }
  return Buffer2.from(content, "utf-8");
}
var KnowledgeTestSuite = class {
  name = "knowledge";
  description = "Tests for the Knowledge plugin including document processing, retrieval, and integration";
  tests = [
    // Configuration Tests
    {
      name: "Should handle default docs folder configuration",
      fn: async (runtime) => {
        const originalEnv = { ...process.env };
        delete process.env.KNOWLEDGE_PATH;
        try {
          const docsPath = path.join(process.cwd(), "docs");
          const docsExists = fs.existsSync(docsPath);
          if (!docsExists) {
            fs.mkdirSync(docsPath, { recursive: true });
          }
          await index_default.init({}, runtime);
          const errorCalls = mockLogger.error.calls;
          if (errorCalls.length > 0) {
            throw new Error(`Unexpected error during init: ${errorCalls[0]}`);
          }
          if (!docsExists) {
            fs.rmSync(docsPath, { recursive: true, force: true });
          }
        } finally {
          process.env = originalEnv;
        }
      }
    },
    {
      name: "Should throw error when no docs folder and no path configured",
      fn: async (runtime) => {
        const originalEnv = { ...process.env };
        delete process.env.KNOWLEDGE_PATH;
        try {
          const docsPath = path.join(process.cwd(), "docs");
          if (fs.existsSync(docsPath)) {
            fs.renameSync(docsPath, docsPath + ".backup");
          }
          await index_default.init({}, runtime);
          if (fs.existsSync(docsPath + ".backup")) {
            fs.renameSync(docsPath + ".backup", docsPath);
          }
        } finally {
          process.env = originalEnv;
        }
      }
    },
    // Service Lifecycle Tests
    {
      name: "Should initialize KnowledgeService correctly",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        if (!service) {
          throw new Error("Service initialization failed");
        }
        if (service.capabilityDescription !== "Provides Retrieval Augmented Generation capabilities, including knowledge upload and querying.") {
          throw new Error("Incorrect service capability description");
        }
        runtime.services.set(KnowledgeService.serviceType, service);
        const retrievedService = runtime.getService(
          KnowledgeService.serviceType
        );
        if (retrievedService !== service) {
          throw new Error("Service not properly registered with runtime");
        }
        await service.stop();
      }
    },
    // Document Processing Tests
    {
      name: "Should extract text from text files",
      fn: async (runtime) => {
        const testContent = "This is a test document with some content.";
        const buffer = createTestFileBuffer(testContent);
        const extractedText = await extractTextFromDocument(
          buffer,
          "text/plain",
          "test.txt"
        );
        if (extractedText !== testContent) {
          throw new Error(`Expected "${testContent}", got "${extractedText}"`);
        }
      }
    },
    {
      name: "Should handle empty file buffer",
      fn: async (runtime) => {
        const emptyBuffer = Buffer2.alloc(0);
        try {
          await extractTextFromDocument(emptyBuffer, "text/plain", "empty.txt");
          throw new Error("Should have thrown error for empty buffer");
        } catch (error) {
          if (!error.message.includes("Empty file buffer")) {
            throw new Error(`Unexpected error: ${error.message}`);
          }
        }
      }
    },
    {
      name: "Should create document memory correctly",
      fn: async (runtime) => {
        const params = {
          text: "Test document content",
          agentId: runtime.agentId,
          clientDocumentId: v4_default(),
          originalFilename: "test-doc.txt",
          contentType: "text/plain",
          worldId: v4_default(),
          fileSize: 1024
        };
        const memory = createDocumentMemory(params);
        if (!memory.id) {
          throw new Error("Document memory should have an ID");
        }
        if (memory.metadata?.type !== MemoryType3.DOCUMENT) {
          throw new Error("Document memory should have DOCUMENT type");
        }
        if (memory.content.text !== params.text) {
          throw new Error("Document memory content mismatch");
        }
        if (memory.metadata.originalFilename !== params.originalFilename) {
          throw new Error("Document memory metadata mismatch");
        }
      }
    },
    // Knowledge Addition Tests
    {
      name: "Should add knowledge successfully",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        runtime.services.set(KnowledgeService.serviceType, service);
        const testDocument = {
          clientDocumentId: v4_default(),
          contentType: "text/plain",
          originalFilename: "knowledge-test.txt",
          worldId: runtime.agentId,
          content: "This is test knowledge that should be stored and retrievable.",
          roomId: runtime.agentId,
          entityId: runtime.agentId
        };
        const result = await service.addKnowledge(testDocument);
        if (result.clientDocumentId !== testDocument.clientDocumentId) {
          throw new Error("Client document ID mismatch");
        }
        if (!result.storedDocumentMemoryId) {
          throw new Error("No stored document memory ID returned");
        }
        if (result.fragmentCount === 0) {
          throw new Error("No fragments created");
        }
        const storedDoc = await runtime.getMemoryById(
          result.storedDocumentMemoryId
        );
        if (!storedDoc) {
          throw new Error("Document not found in storage");
        }
        await service.stop();
      }
    },
    {
      name: "Should handle duplicate document uploads",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        runtime.services.set(KnowledgeService.serviceType, service);
        const testDocument = {
          clientDocumentId: v4_default(),
          contentType: "text/plain",
          originalFilename: "duplicate-test.txt",
          worldId: runtime.agentId,
          content: "This document will be uploaded twice.",
          roomId: runtime.agentId,
          entityId: runtime.agentId
        };
        const result1 = await service.addKnowledge(testDocument);
        const result2 = await service.addKnowledge(testDocument);
        if (result1.storedDocumentMemoryId !== result2.storedDocumentMemoryId) {
          throw new Error("Duplicate upload created new document");
        }
        if (result1.fragmentCount !== result2.fragmentCount) {
          throw new Error("Fragment count mismatch on duplicate upload");
        }
        await service.stop();
      }
    },
    // Knowledge Retrieval Tests
    {
      name: "Should retrieve knowledge based on query",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        runtime.services.set(KnowledgeService.serviceType, service);
        const testDocument = {
          clientDocumentId: v4_default(),
          contentType: "text/plain",
          originalFilename: "retrieval-test.txt",
          worldId: runtime.agentId,
          content: "The capital of France is Paris. Paris is known for the Eiffel Tower.",
          roomId: runtime.agentId,
          entityId: runtime.agentId
        };
        await service.addKnowledge(testDocument);
        const queryMessage = {
          id: v4_default(),
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          roomId: runtime.agentId,
          content: {
            text: "What is the capital of France?"
          }
        };
        const results = await service.getKnowledge(queryMessage);
        if (results.length === 0) {
          throw new Error("No knowledge retrieved");
        }
        const hasRelevantContent = results.some(
          (item) => item.content.text?.toLowerCase().includes("paris") || item.content.text?.toLowerCase().includes("france")
        );
        if (!hasRelevantContent) {
          throw new Error("Retrieved knowledge not relevant to query");
        }
        await service.stop();
      }
    },
    // Provider Tests
    {
      name: "Should format knowledge in provider output",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        runtime.services.set("knowledge", service);
        const testDocument = {
          clientDocumentId: v4_default(),
          contentType: "text/plain",
          originalFilename: "provider-test.txt",
          worldId: runtime.agentId,
          content: "Important fact 1. Important fact 2. Important fact 3.",
          roomId: runtime.agentId,
          entityId: runtime.agentId
        };
        await service.addKnowledge(testDocument);
        const message = {
          id: v4_default(),
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          roomId: runtime.agentId,
          content: {
            text: "Tell me about important facts"
          }
        };
        const originalGetKnowledge = service.getKnowledge.bind(service);
        service.getKnowledge = async (msg) => {
          return [
            {
              id: v4_default(),
              content: { text: "Important fact 1." },
              metadata: void 0
            },
            {
              id: v4_default(),
              content: { text: "Important fact 2." },
              metadata: void 0
            }
          ];
        };
        const state = {
          values: {},
          data: {},
          text: ""
        };
        const result = await knowledgeProvider.get(runtime, message, state);
        if (!result.text) {
          throw new Error("Provider returned no text");
        }
        if (!result.text.includes("# Knowledge")) {
          throw new Error("Provider output missing knowledge header");
        }
        if (!result.text.includes("Important fact")) {
          throw new Error("Provider output missing knowledge content");
        }
        service.getKnowledge = originalGetKnowledge;
        await service.stop();
      }
    },
    // Character Knowledge Tests
    {
      name: "Should process character knowledge on startup",
      fn: async (runtime) => {
        const knowledgeRuntime = createMockRuntime({
          character: {
            name: "Knowledge Agent",
            bio: ["Agent with knowledge"],
            knowledge: [
              "The sky is blue.",
              "Water boils at 100 degrees Celsius.",
              "Path: docs/test.md\nThis is markdown content."
            ]
          }
        });
        const service = await KnowledgeService.start(knowledgeRuntime);
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        const memories = await knowledgeRuntime.getMemories({
          tableName: "documents",
          entityId: knowledgeRuntime.agentId
        });
        if (memories.length < 3) {
          throw new Error(
            `Expected at least 3 character knowledge items, got ${memories.length}`
          );
        }
        const pathKnowledge = memories.find(
          (m) => m.content.text?.includes("markdown content")
        );
        if (!pathKnowledge) {
          throw new Error("Path-based knowledge not found");
        }
        const metadata = pathKnowledge.metadata;
        if (!metadata.path || !metadata.filename) {
          throw new Error("Path-based knowledge missing file metadata");
        }
        await service.stop();
      }
    },
    // Error Handling Tests
    {
      name: "Should handle and log errors appropriately",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        runtime.services.set(KnowledgeService.serviceType, service);
        mockLogger.clearCalls();
        try {
          await service.addKnowledge({
            clientDocumentId: v4_default(),
            contentType: "text/plain",
            originalFilename: "empty.txt",
            worldId: runtime.agentId,
            content: "",
            // Empty content should cause an error
            roomId: runtime.agentId,
            entityId: runtime.agentId
          });
          throw new Error("Expected error for empty content");
        } catch (error) {
          if (!error.message.includes("Empty file buffer") && !error.message.includes("Expected error for empty content")) {
          }
        }
        try {
          await service.addKnowledge({
            clientDocumentId: v4_default(),
            contentType: "text/plain",
            originalFilename: "null-content.txt",
            worldId: runtime.agentId,
            content: null,
            // This should definitely cause an error
            roomId: runtime.agentId,
            entityId: runtime.agentId
          });
        } catch (error) {
        }
        await service.stop();
      }
    },
    // Integration Tests
    {
      name: "End-to-end knowledge workflow test",
      fn: async (runtime) => {
        await index_default.init(
          {
            EMBEDDING_PROVIDER: "openai",
            OPENAI_API_KEY: "test-key",
            TEXT_EMBEDDING_MODEL: "text-embedding-3-small"
          },
          runtime
        );
        const service = await KnowledgeService.start(runtime);
        runtime.services.set(KnowledgeService.serviceType, service);
        runtime.services.set("knowledge", service);
        runtime.registerProvider(knowledgeProvider);
        const document = {
          clientDocumentId: v4_default(),
          contentType: "text/plain",
          originalFilename: "integration-test.txt",
          worldId: runtime.agentId,
          content: `
            Quantum computing uses quantum bits or qubits.
            Unlike classical bits, qubits can exist in superposition.
            This allows quantum computers to process many calculations simultaneously.
            Major companies like IBM, Google, and Microsoft are developing quantum computers.
          `,
          roomId: runtime.agentId,
          entityId: runtime.agentId
        };
        const addResult = await service.addKnowledge(document);
        if (addResult.fragmentCount === 0) {
          throw new Error("No fragments created in integration test");
        }
        const queryMessage = {
          id: v4_default(),
          entityId: runtime.agentId,
          agentId: runtime.agentId,
          roomId: runtime.agentId,
          content: {
            text: "What are qubits?"
          }
        };
        const knowledge = await service.getKnowledge(queryMessage);
        if (knowledge.length === 0) {
          throw new Error("No knowledge retrieved in integration test");
        }
        const state = {
          values: {},
          data: {},
          text: ""
        };
        const providerResult = await knowledgeProvider.get(
          runtime,
          queryMessage,
          state
        );
        if (!providerResult.text || !providerResult.text.includes("qubit")) {
          throw new Error("Provider did not return relevant knowledge");
        }
        if (!providerResult.values || !providerResult.values.knowledge || !providerResult.data || !providerResult.data.knowledge) {
          throw new Error("Provider result missing knowledge in values/data");
        }
        await service.stop();
      }
    },
    // Performance and Limits Tests
    {
      name: "Should handle large documents with chunking",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        runtime.services.set(KnowledgeService.serviceType, service);
        const largeContent = Array(100).fill(
          "This is a paragraph of text that will be repeated many times to create a large document for testing chunking functionality. "
        ).join("\n\n");
        const document = {
          clientDocumentId: v4_default(),
          contentType: "text/plain",
          originalFilename: "large-document.txt",
          worldId: runtime.agentId,
          content: largeContent,
          roomId: runtime.agentId,
          entityId: runtime.agentId
        };
        const result = await service.addKnowledge(document);
        if (result.fragmentCount < 2) {
          throw new Error(
            "Large document should be split into multiple fragments"
          );
        }
        const fragments = await runtime.getMemories({
          tableName: "knowledge",
          roomId: runtime.agentId
        });
        const documentFragments = fragments.filter(
          (f) => f.metadata?.documentId === document.clientDocumentId
        );
        if (documentFragments.length !== result.fragmentCount) {
          throw new Error("Fragment count mismatch");
        }
        await service.stop();
      }
    },
    // Binary File Handling Tests
    {
      name: "Should detect binary content types correctly",
      fn: async (runtime) => {
        const service = await KnowledgeService.start(runtime);
        const binaryTypes = [
          { type: "application/pdf", filename: "test.pdf", expected: true },
          { type: "image/png", filename: "test.png", expected: true },
          {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename: "test.docx",
            expected: true
          },
          { type: "text/plain", filename: "test.txt", expected: false },
          { type: "application/json", filename: "test.tson", expected: false },
          {
            type: "application/octet-stream",
            filename: "unknown.bin",
            expected: true
          }
        ];
        for (const test of binaryTypes) {
          const result = isBinaryContentType(test.type, test.filename);
          if (result !== test.expected) {
            throw new Error(
              `Binary detection failed for ${test.type}/${test.filename}. Expected ${test.expected}, got ${result}`
            );
          }
        }
        await service.stop();
      }
    }
  ];
};
var tests_default = new KnowledgeTestSuite();

// src/actions.ts
import { logger as logger4, createUniqueUuid as createUniqueUuid2 } from "@elizaos/core";
import * as fs2 from "fs";
import * as path2 from "path";
var processKnowledgeAction = {
  name: "PROCESS_KNOWLEDGE",
  description: "Process and store knowledge from a file path or text content into the knowledge base",
  similes: [],
  examples: [
    [
      {
        name: "user",
        content: {
          text: "Process the document at /path/to/document.pdf"
        }
      },
      {
        name: "assistant",
        content: {
          text: "I'll process the document at /path/to/document.pdf and add it to my knowledge base.",
          actions: ["PROCESS_KNOWLEDGE"]
        }
      }
    ],
    [
      {
        name: "user",
        content: {
          text: "Add this to your knowledge: The capital of France is Paris."
        }
      },
      {
        name: "assistant",
        content: {
          text: "I'll add that information to my knowledge base.",
          actions: ["PROCESS_KNOWLEDGE"]
        }
      }
    ]
  ],
  validate: async (runtime, message, state) => {
    const text = message.content.text?.toLowerCase() || "";
    const knowledgeKeywords = [
      "process",
      "add",
      "upload",
      "document",
      "knowledge",
      "learn",
      "remember",
      "store",
      "ingest",
      "file"
    ];
    const hasKeyword = knowledgeKeywords.some(
      (keyword) => text.includes(keyword)
    );
    const pathPattern = /(?:\/[\w.-]+)+|(?:[a-zA-Z]:[\\/][\w\s.-]+(?:[\\/][\w\s.-]+)*)/;
    const hasPath = pathPattern.test(text);
    const service = runtime.getService(KnowledgeService.serviceType);
    if (!service) {
      logger4.warn(
        "Knowledge service not available for PROCESS_KNOWLEDGE action"
      );
      return false;
    }
    return hasKeyword || hasPath;
  },
  handler: async (runtime, message, state, options, callback) => {
    try {
      const service = runtime.getService(
        KnowledgeService.serviceType
      );
      if (!service) {
        throw new Error("Knowledge service not available");
      }
      const text = message.content.text || "";
      const pathPattern = /(?:\/[\w.-]+)+|(?:[a-zA-Z]:[\\/][\w\s.-]+(?:[\\/][\w\s.-]+)*)/;
      const pathMatch = text.match(pathPattern);
      let response;
      if (pathMatch) {
        const filePath = pathMatch[0];
        if (!fs2.existsSync(filePath)) {
          response = {
            text: `I couldn't find the file at ${filePath}. Please check the path and try again.`
          };
          if (callback) {
            await callback(response);
          }
          return;
        }
        const fileBuffer = fs2.readFileSync(filePath);
        const fileName = path2.basename(filePath);
        const fileExt = path2.extname(filePath).toLowerCase();
        let contentType = "text/plain";
        if (fileExt === ".pdf") contentType = "application/pdf";
        else if (fileExt === ".docx")
          contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (fileExt === ".doc") contentType = "application/msword";
        else if ([".txt", ".md", ".tson", ".xml", ".csv"].includes(fileExt))
          contentType = "text/plain";
        const knowledgeOptions = {
          clientDocumentId: createUniqueUuid2(runtime.agentId + fileName + Date.now(), fileName),
          contentType,
          originalFilename: fileName,
          worldId: runtime.agentId,
          content: fileBuffer.toString("base64"),
          roomId: message.roomId,
          entityId: message.entityId
        };
        const result = await service.addKnowledge(knowledgeOptions);
        response = {
          text: `I've successfully processed the document "${fileName}". It has been split into ${result.fragmentCount} searchable fragments and added to my knowledge base.`
        };
      } else {
        const knowledgeContent = text.replace(
          /^(add|store|remember|process|learn)\s+(this|that|the following)?:?\s*/i,
          ""
        ).trim();
        if (!knowledgeContent) {
          response = {
            text: "I need some content to add to my knowledge base. Please provide text or a file path."
          };
          if (callback) {
            await callback(response);
          }
          return;
        }
        const knowledgeOptions = {
          clientDocumentId: createUniqueUuid2(runtime.agentId + "text" + Date.now(), "user-knowledge"),
          contentType: "text/plain",
          originalFilename: "user-knowledge.txt",
          worldId: runtime.agentId,
          content: knowledgeContent,
          roomId: message.roomId,
          entityId: message.entityId
        };
        const result = await service.addKnowledge(knowledgeOptions);
        response = {
          text: `I've added that information to my knowledge base. It has been stored and indexed for future reference.`
        };
      }
      if (callback) {
        await callback(response);
      }
    } catch (error) {
      logger4.error("Error in PROCESS_KNOWLEDGE action:", error);
      const errorResponse = {
        text: `I encountered an error while processing the knowledge: ${error instanceof Error ? error.message : "Unknown error"}`
      };
      if (callback) {
        await callback(errorResponse);
      }
    }
  }
};
var searchKnowledgeAction = {
  name: "SEARCH_KNOWLEDGE",
  description: "Search the knowledge base for specific information",
  similes: [
    "search knowledge",
    "find information",
    "look up",
    "query knowledge base",
    "search documents",
    "find in knowledge"
  ],
  examples: [
    [
      {
        name: "user",
        content: {
          text: "Search your knowledge for information about quantum computing"
        }
      },
      {
        name: "assistant",
        content: {
          text: "I'll search my knowledge base for information about quantum computing.",
          actions: ["SEARCH_KNOWLEDGE"]
        }
      }
    ]
  ],
  validate: async (runtime, message, state) => {
    const text = message.content.text?.toLowerCase() || "";
    const searchKeywords = [
      "search",
      "find",
      "look up",
      "query",
      "what do you know about"
    ];
    const knowledgeKeywords = [
      "knowledge",
      "information",
      "document",
      "database"
    ];
    const hasSearchKeyword = searchKeywords.some(
      (keyword) => text.includes(keyword)
    );
    const hasKnowledgeKeyword = knowledgeKeywords.some(
      (keyword) => text.includes(keyword)
    );
    const service = runtime.getService(KnowledgeService.serviceType);
    if (!service) {
      return false;
    }
    return hasSearchKeyword && hasKnowledgeKeyword;
  },
  handler: async (runtime, message, state, options, callback) => {
    try {
      const service = runtime.getService(
        KnowledgeService.serviceType
      );
      if (!service) {
        throw new Error("Knowledge service not available");
      }
      const text = message.content.text || "";
      const query = text.replace(
        /^(search|find|look up|query)\s+(your\s+)?knowledge\s+(base\s+)?(for\s+)?/i,
        ""
      ).trim();
      if (!query) {
        const response2 = {
          text: "What would you like me to search for in my knowledge base?"
        };
        if (callback) {
          await callback(response2);
        }
        return;
      }
      const searchMessage = {
        ...message,
        content: {
          text: query
        }
      };
      const results = await service.getKnowledge(searchMessage);
      let response;
      if (results.length === 0) {
        response = {
          text: `I couldn't find any information about "${query}" in my knowledge base.`
        };
      } else {
        const formattedResults = results.slice(0, 3).map((item, index) => `${index + 1}. ${item.content.text}`).join("\n\n");
        response = {
          text: `Here's what I found about "${query}":

${formattedResults}`
        };
      }
      if (callback) {
        await callback(response);
      }
    } catch (error) {
      logger4.error("Error in SEARCH_KNOWLEDGE action:", error);
      const errorResponse = {
        text: `I encountered an error while searching the knowledge base: ${error instanceof Error ? error.message : "Unknown error"}`
      };
      if (callback) {
        await callback(errorResponse);
      }
    }
  }
};
var knowledgeActions = [processKnowledgeAction, searchKnowledgeAction];

// src/routes.ts
import { MemoryType as MemoryType4, createUniqueUuid as createUniqueUuid3, logger as logger5 } from "@elizaos/core";
import fs3 from "fs";
import path3 from "path";
import multer from "multer";
var createUploadMiddleware = (runtime) => {
  const uploadDir = runtime.getSetting("KNOWLEDGE_UPLOAD_DIR") || "/tmp/uploads/";
  const maxFileSize = parseInt(runtime.getSetting("KNOWLEDGE_MAX_FILE_SIZE") || "52428800");
  const maxFiles = parseInt(runtime.getSetting("KNOWLEDGE_MAX_FILES") || "10");
  const allowedMimeTypes = runtime.getSetting("KNOWLEDGE_ALLOWED_MIME_TYPES")?.split(",") || [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/html",
    "application/json",
    "application/xml",
    "text/csv"
  ];
  return multer({
    dest: uploadDir,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `File type ${file.mimetype} not allowed. Allowed types: ${allowedMimeTypes.join(", ")}`
          )
        );
      }
    }
  });
};
function sendSuccess(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: true, data }));
}
function sendError(res, status, code, message, details) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, error: { code, message, details } }));
}
var cleanupFile = (filePath) => {
  if (filePath && fs3.existsSync(filePath)) {
    try {
      fs3.unlinkSync(filePath);
    } catch (error) {
      logger5.error(`Error cleaning up file ${filePath}:`, error);
    }
  }
};
var cleanupFiles = (files) => {
  if (files) {
    files.forEach((file) => cleanupFile(file.path));
  }
};
async function uploadKnowledgeHandler(req, res, runtime) {
  const service = runtime.getService(KnowledgeService.serviceType);
  if (!service) {
    return sendError(res, 500, "SERVICE_NOT_FOUND", "KnowledgeService not found");
  }
  const hasUploadedFiles = req.files && req.files.length > 0;
  const isJsonRequest = !hasUploadedFiles && req.body && (req.body.fileUrl || req.body.fileUrls);
  if (!hasUploadedFiles && !isJsonRequest) {
    return sendError(res, 400, "INVALID_REQUEST", "Request must contain either files or URLs");
  }
  try {
    if (hasUploadedFiles) {
      const files = req.files;
      if (!files || files.length === 0) {
        return sendError(res, 400, "NO_FILES", "No files uploaded");
      }
      const processingPromises = files.map(async (file, index) => {
        let knowledgeId;
        const originalFilename = file.originalname;
        const agentId = req.body.agentId || req.query.agentId || runtime.agentId;
        const worldId = req.body.worldId || agentId;
        const filePath = file.path;
        knowledgeId = req.body?.documentIds && req.body.documentIds[index] || req.body?.documentId || createUniqueUuid3(runtime, `knowledge-${originalFilename}-${Date.now()}`);
        try {
          const fileBuffer = await fs3.promises.readFile(filePath);
          const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "";
          const filename = file.originalname;
          const title = filename.replace(`.${fileExt}`, "");
          const base64Content = fileBuffer.toString("base64");
          const knowledgeItem = {
            id: knowledgeId,
            content: {
              text: base64Content
            },
            metadata: {
              type: MemoryType4.DOCUMENT,
              timestamp: Date.now(),
              source: "upload",
              filename,
              fileExt,
              title,
              path: originalFilename,
              fileType: file.mimetype,
              fileSize: file.size
            }
          };
          const addKnowledgeOpts = {
            clientDocumentId: knowledgeId,
            // This is knowledgeItem.id
            contentType: file.mimetype,
            // Directly from multer file object
            originalFilename,
            // Directly from multer file object
            content: base64Content,
            // The base64 string of the file
            worldId,
            roomId: agentId,
            // Use the correct agent ID
            entityId: agentId
            // Use the correct agent ID
          };
          await service.addKnowledge(addKnowledgeOpts);
          cleanupFile(filePath);
          return {
            id: knowledgeId,
            filename: originalFilename,
            type: file.mimetype,
            size: file.size,
            uploadedAt: Date.now(),
            status: "success"
          };
        } catch (fileError) {
          logger5.error(
            `[KNOWLEDGE UPLOAD HANDLER] Error processing file ${file.originalname}: ${fileError}`
          );
          cleanupFile(filePath);
          return {
            id: knowledgeId,
            filename: originalFilename,
            status: "error_processing",
            error: fileError.message
          };
        }
      });
      const results = await Promise.all(processingPromises);
      sendSuccess(res, results);
    } else if (isJsonRequest) {
      const fileUrls = Array.isArray(req.body.fileUrls) ? req.body.fileUrls : req.body.fileUrl ? [req.body.fileUrl] : [];
      if (fileUrls.length === 0) {
        return sendError(res, 400, "MISSING_URL", "File URL is required");
      }
      const agentId = req.body.agentId || req.query.agentId || runtime.agentId;
      const processingPromises = fileUrls.map(async (fileUrl) => {
        try {
          const normalizedUrl = normalizeS3Url(fileUrl);
          const knowledgeId = createUniqueUuid3(runtime, normalizedUrl);
          const urlObject = new URL(fileUrl);
          const pathSegments = urlObject.pathname.split("/");
          const encodedFilename = pathSegments[pathSegments.length - 1] || "document.pdf";
          const originalFilename = decodeURIComponent(encodedFilename);
          logger5.info(`[KNOWLEDGE URL HANDLER] Fetching content from URL: ${fileUrl}`);
          const { content, contentType: fetchedContentType } = await fetchUrlContent(fileUrl);
          let contentType = fetchedContentType;
          if (contentType === "application/octet-stream") {
            const fileExtension = originalFilename.split(".").pop()?.toLowerCase();
            if (fileExtension) {
              if (["pdf"].includes(fileExtension)) {
                contentType = "application/pdf";
              } else if (["txt", "text"].includes(fileExtension)) {
                contentType = "text/plain";
              } else if (["md", "markdown"].includes(fileExtension)) {
                contentType = "text/markdown";
              } else if (["doc", "docx"].includes(fileExtension)) {
                contentType = "application/msword";
              } else if (["html", "htm"].includes(fileExtension)) {
                contentType = "text/html";
              } else if (["json"].includes(fileExtension)) {
                contentType = "application/json";
              } else if (["xml"].includes(fileExtension)) {
                contentType = "application/xml";
              }
            }
          }
          const addKnowledgeOpts = {
            clientDocumentId: knowledgeId,
            contentType,
            originalFilename,
            content,
            // Use the base64 encoded content from the URL
            worldId: agentId,
            roomId: agentId,
            entityId: agentId,
            // Store the normalized URL in metadata
            metadata: {
              url: normalizedUrl
            }
          };
          logger5.debug(
            `[KNOWLEDGE URL HANDLER] Processing knowledge from URL: ${fileUrl} (type: ${contentType})`
          );
          const result = await service.addKnowledge(addKnowledgeOpts);
          return {
            id: result.clientDocumentId,
            fileUrl,
            filename: originalFilename,
            message: "Knowledge created successfully",
            createdAt: Date.now(),
            fragmentCount: result.fragmentCount,
            status: "success"
          };
        } catch (urlError) {
          logger5.error(`[KNOWLEDGE URL HANDLER] Error processing URL ${fileUrl}: ${urlError}`);
          return {
            fileUrl,
            status: "error_processing",
            error: urlError.message
          };
        }
      });
      const results = await Promise.all(processingPromises);
      sendSuccess(res, results);
    }
  } catch (error) {
    logger5.error("[KNOWLEDGE HANDLER] Error processing knowledge:", error);
    if (hasUploadedFiles) {
      cleanupFiles(req.files);
    }
    sendError(res, 500, "PROCESSING_ERROR", "Failed to process knowledge", error.message);
  }
}
async function getKnowledgeDocumentsHandler(req, res, runtime) {
  const service = runtime.getService(KnowledgeService.serviceType);
  if (!service) {
    return sendError(
      res,
      500,
      "SERVICE_NOT_FOUND",
      "KnowledgeService not found for getKnowledgeDocumentsHandler"
    );
  }
  try {
    const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : 20;
    const before = req.query.before ? Number.parseInt(req.query.before, 10) : Date.now();
    const includeEmbedding = req.query.includeEmbedding === "true";
    const agentId = req.query.agentId;
    const fileUrls = req.query.fileUrls ? typeof req.query.fileUrls === "string" && req.query.fileUrls.includes(",") ? req.query.fileUrls.split(",") : [req.query.fileUrls] : null;
    const memories = await service.getMemories({
      tableName: "documents",
      count: limit,
      end: before
    });
    let filteredMemories = memories;
    if (fileUrls && fileUrls.length > 0) {
      const normalizedRequestUrls = fileUrls.map((url) => normalizeS3Url(url));
      const urlBasedIds = normalizedRequestUrls.map(
        (url) => createUniqueUuid3(runtime, url)
      );
      filteredMemories = memories.filter(
        (memory) => urlBasedIds.includes(memory.id) || // If the ID corresponds directly
        // Or if the URL is stored in the metadata (check if it exists)
        memory.metadata && "url" in memory.metadata && typeof memory.metadata.url === "string" && normalizedRequestUrls.includes(normalizeS3Url(memory.metadata.url))
      );
      logger5.debug(
        `[KNOWLEDGE GET HANDLER] Filtered documents by URLs: ${fileUrls.length} URLs, found ${filteredMemories.length} matching documents`
      );
    }
    const cleanMemories = includeEmbedding ? filteredMemories : filteredMemories.map((memory) => ({
      ...memory,
      embedding: void 0
    }));
    sendSuccess(res, {
      memories: cleanMemories,
      urlFiltered: fileUrls ? true : false,
      totalFound: cleanMemories.length,
      totalRequested: fileUrls ? fileUrls.length : 0
    });
  } catch (error) {
    logger5.error("[KNOWLEDGE GET HANDLER] Error retrieving documents:", error);
    sendError(res, 500, "RETRIEVAL_ERROR", "Failed to retrieve documents", error.message);
  }
}
async function deleteKnowledgeDocumentHandler(req, res, runtime) {
  logger5.debug(`[KNOWLEDGE DELETE HANDLER] Received DELETE request:
    - path: ${req.path}
    - params: ${JSON.stringify(req.params)}
  `);
  const service = runtime.getService(KnowledgeService.serviceType);
  if (!service) {
    return sendError(
      res,
      500,
      "SERVICE_NOT_FOUND",
      "KnowledgeService not found for deleteKnowledgeDocumentHandler"
    );
  }
  const knowledgeId = req.params.knowledgeId;
  if (!knowledgeId || knowledgeId.length < 36) {
    logger5.error(`[KNOWLEDGE DELETE HANDLER] Invalid knowledge ID format: ${knowledgeId}`);
    return sendError(res, 400, "INVALID_ID", "Invalid Knowledge ID format");
  }
  try {
    const typedKnowledgeId = knowledgeId;
    logger5.debug(
      `[KNOWLEDGE DELETE HANDLER] Attempting to delete document with ID: ${typedKnowledgeId}`
    );
    await service.deleteMemory(typedKnowledgeId);
    logger5.info(
      `[KNOWLEDGE DELETE HANDLER] Successfully deleted document with ID: ${typedKnowledgeId}`
    );
    sendSuccess(res, null, 204);
  } catch (error) {
    logger5.error(`[KNOWLEDGE DELETE HANDLER] Error deleting document ${knowledgeId}:`, error);
    sendError(res, 500, "DELETE_ERROR", "Failed to delete document", error.message);
  }
}
async function getKnowledgeByIdHandler(req, res, runtime) {
  logger5.debug(`[KNOWLEDGE GET BY ID HANDLER] Received GET request:
    - path: ${req.path}
    - params: ${JSON.stringify(req.params)}
  `);
  const service = runtime.getService(KnowledgeService.serviceType);
  if (!service) {
    return sendError(
      res,
      500,
      "SERVICE_NOT_FOUND",
      "KnowledgeService not found for getKnowledgeByIdHandler"
    );
  }
  const knowledgeId = req.params.knowledgeId;
  if (!knowledgeId || knowledgeId.length < 36) {
    logger5.error(`[KNOWLEDGE GET BY ID HANDLER] Invalid knowledge ID format: ${knowledgeId}`);
    return sendError(res, 400, "INVALID_ID", "Invalid Knowledge ID format");
  }
  try {
    logger5.debug(`[KNOWLEDGE GET BY ID HANDLER] Retrieving document with ID: ${knowledgeId}`);
    const agentId = req.query.agentId;
    const memories = await service.getMemories({
      tableName: "documents",
      count: 1e3
    });
    const typedKnowledgeId = knowledgeId;
    const document = memories.find((memory) => memory.id === typedKnowledgeId);
    if (!document) {
      return sendError(res, 404, "NOT_FOUND", `Knowledge with ID ${typedKnowledgeId} not found`);
    }
    const cleanDocument = {
      ...document,
      embedding: void 0
    };
    sendSuccess(res, { document: cleanDocument });
  } catch (error) {
    logger5.error(`[KNOWLEDGE GET BY ID HANDLER] Error retrieving document ${knowledgeId}:`, error);
    sendError(res, 500, "RETRIEVAL_ERROR", "Failed to retrieve document", error.message);
  }
}
async function knowledgePanelHandler(req, res, runtime) {
  const agentId = runtime.agentId;
  logger5.debug(`[KNOWLEDGE PANEL] Serving panel for agent ${agentId}, request path: ${req.path}`);
  try {
    const currentDir = path3.dirname(new URL(import.meta.url).pathname);
    const frontendPath = path3.join(currentDir, "../dist/index.html");
    logger5.debug(`[KNOWLEDGE PANEL] Looking for frontend at: ${frontendPath}`);
    if (fs3.existsSync(frontendPath)) {
      const html = await fs3.promises.readFile(frontendPath, "utf8");
      const injectedHtml = html.replace(
        "<head>",
        `<head>
          <script>
            window.ELIZA_CONFIG = {
              agentId: '${agentId}',
              apiBase: '/api'
            };
          </script>`
      );
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(injectedHtml);
    } else {
      let cssFile = "index.css";
      let jsFile = "index.js";
      const manifestPath = path3.join(currentDir, "../dist/manifest.json");
      if (fs3.existsSync(manifestPath)) {
        try {
          const manifestContent = await fs3.promises.readFile(manifestPath, "utf8");
          const manifest = JSON.parse(manifestContent);
          for (const [key, value] of Object.entries(manifest)) {
            if (typeof value === "object" && value !== null) {
              if (key.endsWith(".css") || value.file?.endsWith(".css")) {
                cssFile = value.file || key;
              }
              if (key.endsWith(".js") || value.file?.endsWith(".js")) {
                jsFile = value.file || key;
              }
            }
          }
        } catch (manifestError) {
          logger5.error("[KNOWLEDGE PANEL] Error reading manifest:", manifestError);
        }
      }
      logger5.debug(`[KNOWLEDGE PANEL] Using fallback with CSS: ${cssFile}, JS: ${jsFile}`);
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knowledge</title>
    <script>
      window.ELIZA_CONFIG = {
        agentId: '${agentId}',
        apiBase: '/api'
      };
    </script>
    <link rel="stylesheet" href="./assets/${cssFile}">
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .loading { text-align: center; padding: 40px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div id="root">
            <div class="loading">Loading Knowledge Library...</div>
        </div>
    </div>
    <script type="module" src="./assets/${jsFile}"></script>
</body>
</html>`;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    }
  } catch (error) {
    logger5.error("[KNOWLEDGE PANEL] Error serving frontend:", error);
    sendError(res, 500, "FRONTEND_ERROR", "Failed to load knowledge panel", error.message);
  }
}
async function frontendAssetHandler(req, res, runtime) {
  try {
    logger5.debug(
      `[KNOWLEDGE ASSET HANDLER] Called with req.path: ${req.path}, req.originalUrl: ${req.originalUrl}, req.params: ${JSON.stringify(req.params)}`
    );
    const currentDir = path3.dirname(new URL(import.meta.url).pathname);
    const assetRequestPath = req.path;
    const assetsMarker = "/assets/";
    const assetsStartIndex = assetRequestPath.indexOf(assetsMarker);
    let assetName = null;
    if (assetsStartIndex !== -1) {
      assetName = assetRequestPath.substring(assetsStartIndex + assetsMarker.length);
    }
    if (!assetName || assetName.includes("..")) {
      return sendError(
        res,
        400,
        "BAD_REQUEST",
        `Invalid asset name: '${assetName}' from path ${assetRequestPath}`
      );
    }
    const assetPath = path3.join(currentDir, "../dist/assets", assetName);
    logger5.debug(`[KNOWLEDGE ASSET HANDLER] Attempting to serve asset: ${assetPath}`);
    if (fs3.existsSync(assetPath)) {
      const fileStream = fs3.createReadStream(assetPath);
      let contentType = "application/octet-stream";
      if (assetPath.endsWith(".js")) {
        contentType = "application/javascript";
      } else if (assetPath.endsWith(".css")) {
        contentType = "text/css";
      }
      res.writeHead(200, { "Content-Type": contentType });
      fileStream.pipe(res);
    } else {
      sendError(res, 404, "NOT_FOUND", `Asset not found: ${req.url}`);
    }
  } catch (error) {
    logger5.error(`[KNOWLEDGE ASSET HANDLER] Error serving asset ${req.url}:`, error);
    sendError(res, 500, "ASSET_ERROR", `Failed to load asset ${req.url}`, error.message);
  }
}
async function getKnowledgeChunksHandler(req, res, runtime) {
  const service = runtime.getService(KnowledgeService.serviceType);
  if (!service) {
    return sendError(res, 500, "SERVICE_NOT_FOUND", "KnowledgeService not found");
  }
  try {
    const limit = req.query.limit ? Number.parseInt(req.query.limit, 10) : 100;
    const before = req.query.before ? Number.parseInt(req.query.before, 10) : Date.now();
    const documentId = req.query.documentId;
    const agentId = req.query.agentId;
    const chunks = await service.getMemories({
      tableName: "knowledge",
      count: limit,
      end: before
    });
    const filteredChunks = documentId ? chunks.filter(
      (chunk) => chunk.metadata && typeof chunk.metadata === "object" && "documentId" in chunk.metadata && chunk.metadata.documentId === documentId
    ) : chunks;
    sendSuccess(res, { chunks: filteredChunks });
  } catch (error) {
    logger5.error("[KNOWLEDGE CHUNKS GET HANDLER] Error retrieving chunks:", error);
    sendError(res, 500, "RETRIEVAL_ERROR", "Failed to retrieve knowledge chunks", error.message);
  }
}
async function uploadKnowledgeWithMulter(req, res, runtime) {
  const upload = createUploadMiddleware(runtime);
  const uploadArray = upload.array(
    "files",
    parseInt(runtime.getSetting("KNOWLEDGE_MAX_FILES") || "10")
  );
  uploadArray(req, res, (err) => {
    if (err) {
      logger5.error("[KNOWLEDGE UPLOAD] Multer error:", err);
      return sendError(res, 400, "UPLOAD_ERROR", err.message);
    }
    uploadKnowledgeHandler(req, res, runtime);
  });
}
var knowledgeRoutes = [
  {
    type: "GET",
    name: "Knowledge",
    path: "/display",
    handler: knowledgePanelHandler,
    public: true
  },
  {
    type: "GET",
    path: "/assets/*",
    handler: frontendAssetHandler
  },
  {
    type: "POST",
    path: "/documents",
    handler: uploadKnowledgeWithMulter
  },
  {
    type: "GET",
    path: "/documents",
    handler: getKnowledgeDocumentsHandler
  },
  {
    type: "GET",
    path: "/documents/:knowledgeId",
    handler: getKnowledgeByIdHandler
  },
  {
    type: "DELETE",
    path: "/documents/:knowledgeId",
    handler: deleteKnowledgeDocumentHandler
  },
  {
    type: "GET",
    path: "/knowledges",
    handler: getKnowledgeChunksHandler
  }
];

// src/index.ts
var knowledgePlugin = {
  name: "knowledge",
  description: "Plugin for Retrieval Augmented Generation, including knowledge management and embedding.",
  config: {
    // Token limits - these will be read from runtime settings during init
    MAX_INPUT_TOKENS: "4000",
    MAX_OUTPUT_TOKENS: "4096",
    // Contextual Knowledge settings
    CTX_KNOWLEDGE_ENABLED: "false"
  },
  async init(config, runtime) {
    logger6.info("Initializing Knowledge Plugin...");
    try {
      logger6.info("Validating model configuration for Knowledge plugin...");
      const validatedConfig = validateModelConfig(runtime);
      if (validatedConfig.CTX_KNOWLEDGE_ENABLED) {
        logger6.info("Running in Contextual Knowledge mode with text generation capabilities.");
        logger6.info(
          `Using ${validatedConfig.EMBEDDING_PROVIDER} for embeddings and ${validatedConfig.TEXT_PROVIDER} for text generation.`
        );
      } else {
        const usingPluginOpenAI = !process.env.EMBEDDING_PROVIDER;
        if (usingPluginOpenAI) {
          logger6.info(
            "Running in Basic Embedding mode with auto-detected configuration from plugin-openai."
          );
        } else {
          logger6.info(
            "Running in Basic Embedding mode (CTX_KNOWLEDGE_ENABLED=false). TEXT_PROVIDER and TEXT_MODEL not required."
          );
        }
        logger6.info(
          `Using ${validatedConfig.EMBEDDING_PROVIDER} for embeddings with ${validatedConfig.TEXT_EMBEDDING_MODEL}.`
        );
      }
      logger6.info("Model configuration validated successfully.");
      if (runtime) {
        logger6.info(`Knowledge Plugin initialized for agent: ${runtime.agentId}`);
        const loadDocsOnStartup = config.LOAD_DOCS_ON_STARTUP !== "false" && process.env.LOAD_DOCS_ON_STARTUP !== "false";
        if (loadDocsOnStartup) {
          setTimeout(async () => {
            try {
              const service = runtime.getService(KnowledgeService.serviceType);
              if (service instanceof KnowledgeService) {
                const { loadDocsFromPath: loadDocsFromPath2 } = await import("./docs-loader-AEQHIBO4.js");
                const result = await loadDocsFromPath2(service, runtime.agentId);
                if (result.successful > 0) {
                  logger6.info(`Loaded ${result.successful} documents from docs folder on startup`);
                }
              }
            } catch (error) {
              logger6.error("Error loading documents on startup:", error);
            }
          }, 5e3);
        }
      }
      logger6.info(
        "Knowledge Plugin initialized. Frontend panel should be discoverable via its public route."
      );
    } catch (error) {
      logger6.error("Failed to initialize Knowledge plugin:", error);
      throw error;
    }
  },
  services: [KnowledgeService],
  providers: [knowledgeProvider],
  routes: knowledgeRoutes,
  actions: knowledgeActions,
  tests: [tests_default]
};
var index_default = knowledgePlugin;
export {
  KnowledgeServiceType,
  ModelConfigSchema,
  index_default as default,
  knowledgePlugin
};
//# sourceMappingURL=index.js.map