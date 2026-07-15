export interface EchoOptions {
    value: string;
}
export interface EchoResult {
    value: string;
}
export interface ReverseOptions {
    value: string;
}
export interface ReverseResult {
    value: string;
}
export interface SlugifyOptions {
    value: string;
}
export interface SlugifyResult {
    slug: string;
}
/**
 * The `StringKit` plugin interface.
 */
export interface StringKitPlugin {
    /**
     * Returns the input `value` unchanged.
     */
    echo(options: EchoOptions): Promise<EchoResult>;
    /**
     * Returns the input `value` reversed.
     */
    reverse(options: ReverseOptions): Promise<ReverseResult>;
    /**
     * Returns a URL-safe slug of the input `value`.
     */
    slugify(options: SlugifyOptions): Promise<SlugifyResult>;
}
//# sourceMappingURL=definitions.d.ts.map