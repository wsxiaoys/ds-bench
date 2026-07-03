"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Try several endpoints to see which ones work
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
async function main() {
    const client = new sdk_1.default({ apiKey: process.env.ALCHEMYST_AI_API_KEY });
    // 1) view.retrieve
    try {
        const v = await client.v1.context.view.retrieve();
        console.error('[probe] view.retrieve OK:', JSON.stringify(v).slice(0, 400));
    }
    catch (e) {
        console.error('[probe] view.retrieve FAILED:', e?.status, e?.message);
    }
    // 2) view.docs
    try {
        const d = await client.v1.context.view.docs();
        console.error('[probe] view.docs OK:', JSON.stringify(d).slice(0, 400));
    }
    catch (e) {
        console.error('[probe] view.docs FAILED:', e?.status, e?.message);
    }
    // 3) addAsync
    try {
        const a = await client.v1.context.addAsync.create({
            context_type: 'resource',
            documents: [{ content: 'PROBE_DOC: smoke probe' }],
            scope: 'internal',
            source: 'probe-source',
            metadata: { fileName: `probe-${Date.now()}.md`, group_name: ['probe'] },
        });
        console.error('[probe] addAsync OK:', JSON.stringify(a));
    }
    catch (e) {
        console.error('[probe] addAsync FAILED:', e?.status, e?.message);
    }
    // 4) add (the one we used before)
    try {
        const a = await client.v1.context.add({
            context_type: 'resource',
            documents: [{ content: 'PROBE_DOC: smoke probe' }],
            scope: 'internal',
            source: 'probe-source',
            metadata: { fileName: `probe-${Date.now()}.md`, group_name: ['probe'] },
        });
        console.error('[probe] add OK:', JSON.stringify(a));
    }
    catch (e) {
        console.error('[probe] add FAILED:', e?.status, e?.message);
    }
    // 5) search
    try {
        const s = await client.v1.context.search({
            query: 'probe',
            minimum_similarity_threshold: 0.05,
            similarity_threshold: 0.1,
            scope: 'internal',
        });
        console.error('[probe] search (no group) OK:', JSON.stringify(s).slice(0, 400));
    }
    catch (e) {
        console.error('[probe] search FAILED:', e?.status, e?.message);
    }
}
main().catch((e) => {
    console.error('[probe] top-level failure:', e);
    process.exit(1);
});
