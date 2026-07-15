import { WebPlugin } from '@capacitor/core';
import type { StringKitPlugin } from './definitions';
export declare class StringKitWeb extends WebPlugin implements StringKitPlugin {
    echo(options: {
        value: string;
    }): Promise<{
        value: string;
    }>;
    reverse(options: {
        value: string;
    }): Promise<{
        value: string;
    }>;
    slugify(options: {
        value: string;
    }): Promise<{
        slug: string;
    }>;
}
