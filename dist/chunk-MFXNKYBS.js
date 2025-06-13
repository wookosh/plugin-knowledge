// src/docs-loader.ts
import { logger as logger2, createUniqueUuid } from "@elizaos/core";
import * as fs from "fs";
import * as path from "path";

// src/utils.ts
import { Buffer } from "buffer";
import * as mammoth from "mammoth";
import { logger } from "@elizaos/core";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
var PLAIN_TEXT_CONTENT_TYPES = [
  "application/typescript",
  "text/typescript",
  "text/x-python",
  "application/x-python-code",
  "application/yaml",
  "text/yaml",
  "application/x-yaml",
  "application/json",
  "text/markdown",
  "text/csv"
];
var MAX_FALLBACK_SIZE_BYTES = 5 * 1024 * 1024;
var BINARY_CHECK_BYTES = 1024;
async function extractTextFromFileBuffer(fileBuffer, contentType, originalFilename) {
  const lowerContentType = contentType.toLowerCase();
  logger.debug(
    `[TextUtil] Attempting to extract text from ${originalFilename} (type: ${contentType})`
  );
  if (lowerContentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    logger.debug(`[TextUtil] Extracting text from DOCX ${originalFilename} via mammoth.`);
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      logger.debug(
        `[TextUtil] DOCX text extraction complete for ${originalFilename}. Text length: ${result.value.length}`
      );
      return result.value;
    } catch (docxError) {
      const errorMsg = `[TextUtil] Failed to parse DOCX file ${originalFilename}: ${docxError.message}`;
      logger.error(errorMsg, docxError.stack);
      throw new Error(errorMsg);
    }
  } else if (lowerContentType === "application/msword" || originalFilename.toLowerCase().endsWith(".doc")) {
    logger.debug(`[TextUtil] Handling Microsoft Word .doc file: ${originalFilename}`);
    return `[Microsoft Word Document: ${originalFilename}]

This document was indexed for search but cannot be displayed directly in the browser. The original document content is preserved for retrieval purposes.`;
  } else if (lowerContentType.startsWith("text/") || PLAIN_TEXT_CONTENT_TYPES.includes(lowerContentType)) {
    logger.debug(
      `[TextUtil] Extracting text from plain text compatible file ${originalFilename} (type: ${contentType})`
    );
    return fileBuffer.toString("utf-8");
  } else {
    logger.warn(
      `[TextUtil] Unsupported content type: "${contentType}" for ${originalFilename}. Attempting fallback to plain text.`
    );
    if (fileBuffer.length > MAX_FALLBACK_SIZE_BYTES) {
      const sizeErrorMsg = `[TextUtil] File ${originalFilename} (type: ${contentType}) exceeds maximum size for fallback (${MAX_FALLBACK_SIZE_BYTES} bytes). Cannot process as plain text.`;
      logger.error(sizeErrorMsg);
      throw new Error(sizeErrorMsg);
    }
    const initialBytes = fileBuffer.subarray(0, Math.min(fileBuffer.length, BINARY_CHECK_BYTES));
    if (initialBytes.includes(0)) {
      const binaryHeuristicMsg = `[TextUtil] File ${originalFilename} (type: ${contentType}) appears to be binary based on initial byte check. Cannot process as plain text.`;
      logger.error(binaryHeuristicMsg);
      throw new Error(binaryHeuristicMsg);
    }
    try {
      const textContent = fileBuffer.toString("utf-8");
      if (textContent.includes("\uFFFD")) {
        const binaryErrorMsg = `[TextUtil] File ${originalFilename} (type: ${contentType}) seems to be binary or has encoding issues after fallback to plain text (detected \uFFFD).`;
        logger.error(binaryErrorMsg);
        throw new Error(binaryErrorMsg);
      }
      logger.debug(
        `[TextUtil] Successfully processed unknown type ${contentType} as plain text after fallback for ${originalFilename}.`
      );
      return textContent;
    } catch (fallbackError) {
      const finalErrorMsg = `[TextUtil] Unsupported content type: ${contentType} for ${originalFilename}. Fallback to plain text also failed or indicated binary content.`;
      logger.error(finalErrorMsg, fallbackError.message ? fallbackError.stack : void 0);
      throw new Error(finalErrorMsg);
    }
  }
}
async function convertPdfToTextFromBuffer(pdfBuffer, filename) {
  const docName = filename || "unnamed-document";
  logger.debug(`[PdfService] Starting conversion for ${docName}`);
  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    const pdf = await getDocument({ data: uint8Array }).promise;
    const numPages = pdf.numPages;
    const textPages = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      logger.debug(`[PdfService] Processing page ${pageNum}/${numPages}`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lineMap = /* @__PURE__ */ new Map();
      textContent.items.filter(isTextItem).forEach((item) => {
        const yPos = Math.round(item.transform[5]);
        if (!lineMap.has(yPos)) {
          lineMap.set(yPos, []);
        }
        lineMap.get(yPos).push(item);
      });
      const sortedLines = Array.from(lineMap.entries()).sort((a, b) => b[0] - a[0]).map(
        ([_, items]) => items.sort((a, b) => a.transform[4] - b.transform[4]).map((item) => item.str).join(" ")
      );
      textPages.push(sortedLines.join("\n"));
    }
    const fullText = textPages.join("\n\n").replace(/\s+/g, " ").trim();
    logger.debug(`[PdfService] Conversion complete for ${docName}, length: ${fullText.length}`);
    return fullText;
  } catch (error) {
    logger.error(`[PdfService] Error converting PDF ${docName}:`, error.message);
    throw new Error(`Failed to convert PDF to text: ${error.message}`);
  }
}
function isBinaryContentType(contentType, filename) {
  const textContentTypes = [
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/typescript",
    "application/x-yaml",
    "application/x-sh"
  ];
  const isTextMimeType = textContentTypes.some((type) => contentType.includes(type));
  if (isTextMimeType) {
    return false;
  }
  const binaryContentTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
    "image/",
    "audio/",
    "video/"
  ];
  const isBinaryMimeType = binaryContentTypes.some((type) => contentType.includes(type));
  if (isBinaryMimeType) {
    return true;
  }
  const fileExt = filename.split(".").pop()?.toLowerCase() || "";
  const textExtensions = [
    "txt",
    "md",
    "markdown",
    "json",
    "xml",
    "html",
    "htm",
    "css",
    "js",
    "ts",
    "jsx",
    "tsx",
    "yaml",
    "yml",
    "toml",
    "ini",
    "cfg",
    "conf",
    "sh",
    "bash",
    "zsh",
    "fish",
    "py",
    "rb",
    "go",
    "rs",
    "java",
    "c",
    "cpp",
    "h",
    "hpp",
    "cs",
    "php",
    "sql",
    "r",
    "swift",
    "kt",
    "scala",
    "clj",
    "ex",
    "exs",
    "vim",
    "env",
    "gitignore",
    "dockerignore",
    "editorconfig",
    "log",
    "csv",
    "tsv",
    "properties",
    "gradle",
    "sbt",
    "makefile",
    "dockerfile",
    "vagrantfile",
    "gemfile",
    "rakefile",
    "podfile",
    "csproj",
    "vbproj",
    "fsproj",
    "sln",
    "pom"
  ];
  if (textExtensions.includes(fileExt)) {
    return false;
  }
  const binaryExtensions = [
    "pdf",
    "docx",
    "doc",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "zip",
    "rar",
    "7z",
    "tar",
    "gz",
    "bz2",
    "xz",
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "svg",
    "ico",
    "webp",
    "mp3",
    "mp4",
    "avi",
    "mov",
    "wmv",
    "flv",
    "wav",
    "flac",
    "ogg",
    "exe",
    "dll",
    "so",
    "dylib",
    "bin",
    "dat",
    "db",
    "sqlite"
  ];
  return binaryExtensions.includes(fileExt);
}
function isTextItem(item) {
  return "str" in item;
}
function normalizeS3Url(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch (error) {
    logger.warn(`[URL NORMALIZER] Failed to parse URL: ${url}. Returning original.`);
    return url;
  }
}
async function fetchUrlContent(url) {
  logger.debug(`[URL FETCHER] Fetching content from URL: ${url}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e4);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Eliza-Knowledge-Plugin/1.0"
      }
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    logger.debug(`[URL FETCHER] Content type from server: ${contentType} for URL: ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString("base64");
    logger.debug(
      `[URL FETCHER] Successfully fetched content from URL: ${url} (${buffer.length} bytes)`
    );
    return {
      content: base64Content,
      contentType
    };
  } catch (error) {
    logger.error(`[URL FETCHER] Error fetching content from URL ${url}: ${error.message}`);
    throw new Error(`Failed to fetch content from URL: ${error.message}`);
  }
}

// src/docs-loader.ts
function getKnowledgePath() {
  const envPath = process.env.KNOWLEDGE_PATH;
  if (envPath) {
    const resolvedPath = path.resolve(envPath);
    if (!fs.existsSync(resolvedPath)) {
      logger2.warn(`Knowledge path from environment variable does not exist: ${resolvedPath}`);
      logger2.warn("Please create the directory or update KNOWLEDGE_PATH environment variable");
    }
    return resolvedPath;
  }
  const defaultPath = path.join(process.cwd(), "docs");
  if (!fs.existsSync(defaultPath)) {
    logger2.info(`Default docs folder does not exist at: ${defaultPath}`);
    logger2.info("To use the knowledge plugin, either:");
    logger2.info('1. Create a "docs" folder in your project root');
    logger2.info("2. Set KNOWLEDGE_PATH environment variable to your documents folder");
  }
  return defaultPath;
}
async function loadDocsFromPath(service, agentId, worldId) {
  const docsPath = getKnowledgePath();
  if (!fs.existsSync(docsPath)) {
    logger2.warn(`Knowledge path does not exist: ${docsPath}`);
    return { total: 0, successful: 0, failed: 0 };
  }
  logger2.info(`Loading documents from: ${docsPath}`);
  const files = getAllFiles(docsPath);
  if (files.length === 0) {
    logger2.info("No files found in knowledge path");
    return { total: 0, successful: 0, failed: 0 };
  }
  logger2.info(`Found ${files.length} files to process`);
  let successful = 0;
  let failed = 0;
  for (const filePath of files) {
    try {
      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath).toLowerCase();
      if (fileName.startsWith(".")) {
        continue;
      }
      const contentType = getContentType(fileExt);
      if (!contentType) {
        logger2.debug(`Skipping unsupported file type: ${filePath}`);
        continue;
      }
      const fileBuffer = fs.readFileSync(filePath);
      const isBinary = isBinaryContentType(contentType, fileName);
      const content = isBinary ? fileBuffer.toString("base64") : fileBuffer.toString("utf-8");
      const knowledgeOptions = {
        clientDocumentId: createUniqueUuid(agentId, `docs-${fileName}-${Date.now()}`),
        contentType,
        originalFilename: fileName,
        worldId: worldId || agentId,
        content,
        roomId: agentId,
        entityId: agentId
      };
      logger2.debug(`Processing document: ${fileName}`);
      const result = await service.addKnowledge(knowledgeOptions);
      logger2.info(`Successfully processed ${fileName}: ${result.fragmentCount} fragments created`);
      successful++;
    } catch (error) {
      logger2.error(`Failed to process file ${filePath}:`, error);
      failed++;
    }
  }
  logger2.info(
    `Document loading complete: ${successful} successful, ${failed} failed out of ${files.length} total`
  );
  return {
    total: files.length,
    successful,
    failed
  };
}
function getAllFiles(dirPath, files = []) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", ".vscode", "dist", "build"].includes(entry.name)) {
          getAllFiles(fullPath, files);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logger2.error(`Error reading directory ${dirPath}:`, error);
  }
  return files;
}
function getContentType(extension) {
  const contentTypes = {
    // Text documents
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".tson": "text/plain",
    ".xml": "application/xml",
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".log": "text/plain",
    // Web files
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".scss": "text/x-scss",
    ".sass": "text/x-sass",
    ".less": "text/x-less",
    // JavaScript/TypeScript
    ".js": "text/javascript",
    ".jsx": "text/javascript",
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".mjs": "text/javascript",
    ".cjs": "text/javascript",
    ".vue": "text/x-vue",
    ".svelte": "text/x-svelte",
    ".astro": "text/x-astro",
    // Python
    ".py": "text/x-python",
    ".pyw": "text/x-python",
    ".pyi": "text/x-python",
    // Java/Kotlin/Scala
    ".java": "text/x-java",
    ".kt": "text/x-kotlin",
    ".kts": "text/x-kotlin",
    ".scala": "text/x-scala",
    // C/C++/C#
    ".c": "text/x-c",
    ".cpp": "text/x-c++",
    ".cc": "text/x-c++",
    ".cxx": "text/x-c++",
    ".h": "text/x-c",
    ".hpp": "text/x-c++",
    ".cs": "text/x-csharp",
    // Other languages
    ".php": "text/x-php",
    ".rb": "text/x-ruby",
    ".go": "text/x-go",
    ".rs": "text/x-rust",
    ".swift": "text/x-swift",
    ".r": "text/x-r",
    ".R": "text/x-r",
    ".m": "text/x-objectivec",
    ".mm": "text/x-objectivec",
    ".clj": "text/x-clojure",
    ".cljs": "text/x-clojure",
    ".ex": "text/x-elixir",
    ".exs": "text/x-elixir",
    ".lua": "text/x-lua",
    ".pl": "text/x-perl",
    ".pm": "text/x-perl",
    ".dart": "text/x-dart",
    ".hs": "text/x-haskell",
    ".elm": "text/x-elm",
    ".ml": "text/x-ocaml",
    ".fs": "text/x-fsharp",
    ".fsx": "text/x-fsharp",
    ".vb": "text/x-vb",
    ".pas": "text/x-pascal",
    ".d": "text/x-d",
    ".nim": "text/x-nim",
    ".zig": "text/x-zig",
    ".jl": "text/x-julia",
    ".tcl": "text/x-tcl",
    ".awk": "text/x-awk",
    ".sed": "text/x-sed",
    // Shell scripts
    ".sh": "text/x-sh",
    ".bash": "text/x-sh",
    ".zsh": "text/x-sh",
    ".fish": "text/x-fish",
    ".ps1": "text/x-powershell",
    ".bat": "text/x-batch",
    ".cmd": "text/x-batch",
    // Config files
    ".json": "application/json",
    ".yaml": "text/x-yaml",
    ".yml": "text/x-yaml",
    ".toml": "text/x-toml",
    ".ini": "text/x-ini",
    ".cfg": "text/x-ini",
    ".conf": "text/x-ini",
    ".env": "text/plain",
    ".gitignore": "text/plain",
    ".dockerignore": "text/plain",
    ".editorconfig": "text/plain",
    ".properties": "text/x-properties",
    // Database
    ".sql": "text/x-sql",
    // Binary documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
  return contentTypes[extension] || null;
}

export {
  extractTextFromFileBuffer,
  convertPdfToTextFromBuffer,
  isBinaryContentType,
  normalizeS3Url,
  fetchUrlContent,
  getKnowledgePath,
  loadDocsFromPath
};
//# sourceMappingURL=chunk-MFXNKYBS.js.map