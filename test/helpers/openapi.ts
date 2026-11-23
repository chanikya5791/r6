import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { expect } from 'vitest';

type Json = Record<string, any>;

const spec: Json = parse(readFileSync(join(__dirname, '..', '..', 'openapi.yaml'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'spec');

/**
 * Asserts that a supertest response matches the response documented in openapi.yaml
 * for the given path template and method (e.g. '/users/{id}', 'get').
 */
export function expectMatchesSpec(res: { status: number; body: unknown }, path: string, method: string): void {
  const operation = spec.paths?.[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`No operation ${method.toUpperCase()} ${path} in openapi.yaml`);
  const status = String(res.status);
  if (!operation.responses[status]) throw new Error(`Status ${status} is not documented for ${method.toUpperCase()} ${path}`);
  // JSON pointer to the response object, following a $ref to components/responses if there is one.
  let pointer = `#/paths/${escape(path)}/${method.toLowerCase()}/responses/${status}`;
  const ref = operation.responses[status].$ref as string | undefined;
  if (ref) pointer = ref;
  const response = resolve(pointer);
  if (!response.content?.['application/json']?.schema) return; // e.g. 204 No Content
  const validate = ajv.getSchema(`spec${pointer}/content/application~1json/schema`)!;
  const ok = validate(res.body);
  expect(ok, `${method.toUpperCase()} ${path} ${res.status} body does not match spec: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(res.body)}`).toBe(true);
}

const escape = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');

function resolve(ref: string): Json {
  return ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((node: Json, key) => node[key.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
}
