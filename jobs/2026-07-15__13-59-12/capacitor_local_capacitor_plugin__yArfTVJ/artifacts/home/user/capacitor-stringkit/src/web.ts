import { WebPlugin } from '@capacitor/core';

import type {
  EchoOptions,
  EchoResult,
  ReverseOptions,
  ReverseResult,
  SlugifyOptions,
  SlugifyResult,
  StringKitPlugin,
} from './definitions';

/**
 * Web implementation of the {@link StringKitPlugin}.
 */
export class StringKitWeb
  extends WebPlugin
  implements StringKitPlugin
{
  async echo(options: EchoOptions): Promise<EchoResult> {
    return { value: options.value };
  }

  async reverse(options: ReverseOptions): Promise<ReverseResult> {
    return { value: options.value.split('').reverse().join('') };
  }

  async slugify(options: SlugifyOptions): Promise<SlugifyResult> {
    const slug = options.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return { slug };
  }
}