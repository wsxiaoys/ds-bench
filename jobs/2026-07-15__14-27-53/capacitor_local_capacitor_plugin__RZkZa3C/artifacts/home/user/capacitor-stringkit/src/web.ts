import { WebPlugin } from '@capacitor/core';

import type { StringKitPlugin } from './definitions';

export class StringKitWeb extends WebPlugin implements StringKitPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    return { value: options.value };
  }

  async reverse(options: { value: string }): Promise<{ value: string }> {
    const reversed = options.value.split('').reverse().join('');
    return { value: reversed };
  }

  async slugify(options: { value: string }): Promise<{ slug: string }> {
    const slug = options.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return { slug };
  }
}
