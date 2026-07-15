export interface StringKitPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
  reverse(options: { value: string }): Promise<{ value: string }>;
  slugify(options: { value: string }): Promise<{ slug: string }>;
}
