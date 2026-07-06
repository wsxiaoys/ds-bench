import { registerPlugin } from '@capacitor/core';

const Echo = registerPlugin<{
  echo(options: { value: string }): Promise<{ value: string }>;
}>('Echo');

export * from '@capacitor/core';
export { Echo };
