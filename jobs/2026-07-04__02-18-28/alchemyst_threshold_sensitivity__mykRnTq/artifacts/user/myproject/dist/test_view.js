"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = __importDefault(require("@alchemystai/sdk"));
async function main() {
    const apiKey = process.env.ALCHEMYST_AI_API_KEY;
    if (!apiKey) {
        console.error('ALCHEMYST_AI_API_KEY is not set');
        process.exit(1);
    }
    const client = new sdk_1.default({ apiKey });
    console.log('Viewing stored documents...');
    try {
        const stored = await client.v1.context.view.docs();
        console.log('Total documents:', stored);
    }
    catch (err) {
        console.error('Error viewing documents:', err.message);
    }
}
main().catch(console.error);
