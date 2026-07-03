/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A tRPC `DataTransformer` that simply passes `FormData` payloads through
 * unmodified. Used by the `httpLink` branch of the client's `splitLink`
 * so that `FormData` requests are serialized as `multipart/form-data`
 * rather than `application/json`.
 */
export class FormDataTransformer {
  serialize(object: any) {
    if (!(object instanceof FormData)) {
      throw new Error("FormDataTransformer expected a FormData instance");
    }
    return object;
  }

  deserialize(_object: any) {
    return _object as unknown as JSON;
  }
}