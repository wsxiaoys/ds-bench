import { WebPlugin } from '@capacitor/core';
import type { EchoOptions, EchoResult, ReverseOptions, ReverseResult, SlugifyOptions, SlugifyResult, StringKitPlugin } from './definitions';
/**
 * Web implementation of the {@link StringKitPlugin}.
 */
export declare class StringKitWeb extends WebPlugin implements StringKitPlugin {
    echo(options: EchoOptions): Promise<EchoResult>;
    reverse(options: ReverseOptions): Promise<ReverseResult>;
    slugify(options: SlugifyOptions): Promise<SlugifyResult>;
}
//# sourceMappingURL=web.d.ts.map