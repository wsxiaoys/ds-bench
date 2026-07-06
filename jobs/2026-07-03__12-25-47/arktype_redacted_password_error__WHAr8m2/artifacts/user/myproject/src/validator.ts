import { type } from 'arktype';

const redactedActual = () => '<redacted>';
const redactedProblem = () => '<redacted>';
const redactedMessage = () => '<redacted>';

const passwordType = type('12<=string<=128').narrow((data, ctx) => {
  if (!/[a-z]/.test(data)) return ctx.mustBe('lowercase letter');
  if (!/[A-Z]/.test(data)) return ctx.mustBe('uppercase letter');
  if (!/\d/.test(data)) return ctx.mustBe('digit');
  if (!/[^a-zA-Z0-9]/.test(data)) return ctx.mustBe('symbol');
  return true;
}).configure({
  actual: redactedActual,
  problem: redactedProblem,
  message: redactedMessage,
});

const ssnType = type(/^\d{3}-\d{2}-\d{4}$/).configure({
  actual: redactedActual,
  problem: redactedProblem,
  message: redactedMessage,
});

const signUpSchema = type({
  username: '3<=string.alphanumeric<=20',
  password: passwordType,
  confirm: passwordType,
  ssn: ssnType,
}).narrow((data, ctx) => {
  if (data.password !== data.confirm) return ctx.mustBe('equal to password');
  return true;
});

const sensitiveFields = new Set(['password', 'confirm', 'ssn']);

export function validate(input: unknown) {
  const result = signUpSchema(input);
  if (result instanceof type['errors'] || (result && typeof result === 'object' && 'byPath' in (result as object))) {
    const errors = result as any;
    const redacted = errors.transform((e: any) => {
      const path = e.path as PropertyKey[];
      if (path.length > 0 && sensitiveFields.has(String(path[0]))) {
        return e.transform((input: any) => ({ ...input, data: '<redacted>' }));
      }
      if (e.code === 'predicate') {
        return e.transform((input: any) => ({ ...input, data: '<redacted>' }));
      }
      return e;
    });
    return redacted;
  }
  return result;
}

export default signUpSchema;
