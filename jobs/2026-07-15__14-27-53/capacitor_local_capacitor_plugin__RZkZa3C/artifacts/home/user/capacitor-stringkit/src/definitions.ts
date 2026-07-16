export interface StringKitPlugin {
  /**
   * Returns the input value unchanged.
   */
  echo(options: { value: string }): Promise<{ value: string }>;

  /**
   * Returns the input string reversed.
   */
  reverse(options: { value: string }): Promise<{ value: string }>;

  /**
   * Returns a URL-safe slug of the input string.
   *
   * Slug semantics: lowercase the input, replace every run of characters
   * that are not lowercase ASCII letters (a-z) or digits (0-9) with a
   * single hyphen, then strip any leading and trailing hyphens.
   */
  slugify(options: { value: string }): Promise<{ slug: string }>;
}
