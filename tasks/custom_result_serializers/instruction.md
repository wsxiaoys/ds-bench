# Custom Result Serializers in Prefect

## Background
You are building a Prefect 3.0 pipeline that handles sensitive data objects. You need to implement a custom result serializer to obfuscate the data when it is persisted to disk.

## Requirements
1. Create a Python script at `/home/user/myproject/flow.py`.
2. Define a custom data class `SensitiveData` with two attributes: `id` (int) and `secret` (str).
3. Implement a custom Prefect result serializer named `ObfuscatedSerializer` that inherits from `prefect.serializers.Serializer`.
   - The `type` attribute must be `"obfuscated"`.
   - The `dumps` method must serialize the `SensitiveData` object into a JSON-encoded byte string, but the `secret` value must be reversed (e.g., "abc" becomes "cba") before serialization.
   - The `loads` method must deserialize the byte string, reverse the `secret` value back to its original form, and return a `SensitiveData` instance.
4. Define a Prefect task named `generate_data` that:
   - Returns a `SensitiveData` instance with `id=42` and `secret="my_super_secret_token"`.
   - Is configured to persist its results (`persist_result=True`).
   - Uses the `ObfuscatedSerializer` for result serialization.
   - Saves the results to the local directory `/home/user/myproject/results`.
5. Define a Prefect flow named `process_sensitive_data` that calls the `generate_data` task and returns its output.
6. Add an `if __name__ == "__main__":` block that executes the flow.

## Constraints
- Project path: `/home/user/myproject`
- The results must be saved in `/home/user/myproject/results`.
- The `flow.py` script must execute successfully without errors.