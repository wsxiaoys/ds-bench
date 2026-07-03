"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const PORT = 12345;
const storedDocuments = new Map();
// Define hardcoded similarity scores for our designed corpus documents
const docSimilarities = {
    'threshold_doc_1': 0.95, // Highly relevant
    'threshold_doc_2': 0.75, // Semi-relevant
    'threshold_doc_3': 0.55, // Low-relevance
    'threshold_doc_4': 0.35, // Very low relevance
    'threshold_doc_5': 0.15 // Off-topic
};
const server = http.createServer((req, res) => {
    const url = req.url || '';
    const method = req.method || '';
    // Helper to send JSON responses
    const sendJSON = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    };
    // Helper to parse JSON body
    let bodyChunks = [];
    req.on('data', chunk => {
        bodyChunks.push(chunk);
    });
    req.on('end', () => {
        const bodyStr = Buffer.concat(bodyChunks).toString();
        let body = {};
        if (bodyStr) {
            try {
                body = JSON.parse(bodyStr);
            }
            catch (e) {
                return sendJSON(400, { error: 'Invalid JSON' });
            }
        }
        if (method === 'POST' && url === '/api/v1/context/add') {
            const docs = body.documents || [];
            if (!docs || docs.length === 0) {
                return sendJSON(400, { error: 'Missing documents' });
            }
            // Check for 409 conflict
            for (const doc of docs) {
                const fileName = doc.metadata?.file_name;
                if (fileName && storedDocuments.has(fileName)) {
                    return sendJSON(409, {
                        error: `Document with file_name '${fileName}' already exists`,
                        code: 'CONFLICT',
                        status: 409
                    });
                }
            }
            // Store documents
            for (const doc of docs) {
                const fileName = doc.metadata?.file_name;
                if (fileName) {
                    storedDocuments.set(fileName, doc);
                }
            }
            return sendJSON(200, {
                status: 'success',
                documents: docs.map((d, i) => ({ id: `doc_${i}` }))
            });
        }
        if (method === 'POST' && url === '/api/v1/context/search') {
            const query = body.query;
            const threshold = body.similarity_threshold !== undefined ? body.similarity_threshold : 0.7;
            const contexts = [];
            for (const [fileName, doc] of storedDocuments.entries()) {
                // Find which base doc key this corresponds to (e.g. threshold_doc_1_zrpx08jsr1.md -> threshold_doc_1)
                let matchedKey = '';
                for (const key of Object.keys(docSimilarities)) {
                    if (fileName.startsWith(key)) {
                        matchedKey = key;
                        break;
                    }
                }
                const similarity = matchedKey ? docSimilarities[matchedKey] : 0.0;
                if (similarity >= threshold) {
                    contexts.push({
                        content: doc.content,
                        metadata: doc.metadata,
                        similarity: similarity
                    });
                }
            }
            return sendJSON(200, {
                contexts: contexts
            });
        }
        // Default 404
        return sendJSON(404, { error: 'Not Found' });
    });
});
server.listen(PORT, () => {
    console.error(`Mock Alchemyst AI server listening on port ${PORT}`);
});
