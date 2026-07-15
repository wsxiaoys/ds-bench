import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"
STORE_FILE = os.path.join(PROJECT_DIR, "src", "store.ts")
FINAL_DIR = os.path.join(PROJECT_DIR, "__final__")
SPEC_FILE = os.path.join(FINAL_DIR, "store.final.spec.ts")
RESULT_FILE = os.path.join(FINAL_DIR, "result.json")

# The vitest spec exercises the candidate's versioned store against the REAL
# @capacitor/preferences web implementation (backed by localStorage under jsdom).
# Each `it` title maps 1:1 to a step in the task's verification plan.
VITEST_SPEC = r"""
import { describe, it, expect, beforeEach } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { createVersionedStore } from '../src/store';

beforeEach(async () => {
  await Preferences.clear();
});

async function rawEnvelope(key) {
  const { value } = await Preferences.get({ key });
  return value === null ? null : JSON.parse(value);
}

describe('versioned json store', () => {
  it('set/get round-trip stores versioned envelope', async () => {
    const store = createVersionedStore({ key: 'k_roundtrip', version: 3 });
    await store.set({ fullName: 'Ada', locale: 'en', theme: 'dark' });
    expect(await rawEnvelope('k_roundtrip')).toEqual({
      version: 3,
      data: { fullName: 'Ada', locale: 'en', theme: 'dark' },
    });
    expect(await store.get()).toEqual({ fullName: 'Ada', locale: 'en', theme: 'dark' });
  });

  it('get returns null for missing key', async () => {
    const store = createVersionedStore({ key: 'k_absent', version: 3 });
    expect(await store.get()).toBeNull();
  });

  it('get migrates old payload and persists upgrade', async () => {
    await Preferences.set({
      key: 'k_mig',
      value: JSON.stringify({ version: 1, data: { name: 'Bob' } }),
    });
    const store = createVersionedStore({
      key: 'k_mig',
      version: 3,
      migrations: {
        1: (d) => ({ fullName: d.name, locale: 'en' }),
        2: (d) => ({ ...d, theme: 'light' }),
      },
    });
    expect(await store.get()).toEqual({ fullName: 'Bob', locale: 'en', theme: 'light' });
    expect(await rawEnvelope('k_mig')).toEqual({
      version: 3,
      data: { fullName: 'Bob', locale: 'en', theme: 'light' },
    });
  });

  it('get keeps storage intact when a migration throws', async () => {
    await Preferences.set({
      key: 'k_fail',
      value: JSON.stringify({ version: 1, data: { name: 'Eve' } }),
    });
    const store = createVersionedStore({
      key: 'k_fail',
      version: 3,
      migrations: {
        1: () => { throw new Error('boom'); },
        2: (d) => ({ ...d, theme: 'light' }),
      },
    });
    await expect(store.get()).rejects.toThrow();
    expect(await rawEnvelope('k_fail')).toEqual({ version: 1, data: { name: 'Eve' } });
  });

  it('get rejects when stored version is newer than code', async () => {
    await Preferences.set({
      key: 'k_new',
      value: JSON.stringify({ version: 9, data: { any: true } }),
    });
    const store = createVersionedStore({ key: 'k_new', version: 3 });
    await expect(store.get()).rejects.toThrow();
    expect(await rawEnvelope('k_new')).toEqual({ version: 9, data: { any: true } });
  });

  it('remove deletes the key', async () => {
    const store = createVersionedStore({ key: 'k_rm', version: 2 });
    await store.set({ a: 1 });
    await store.remove();
    expect(await store.get()).toBeNull();
    const { value } = await Preferences.get({ key: 'k_rm' });
    expect(value).toBeNull();
  });
});
"""


@pytest.fixture(scope="session")
def vitest_results():
    """Write the spec, run vitest once under jsdom, and return a title -> status map."""
    assert os.path.isfile(STORE_FILE), (
        f"Expected candidate module at {STORE_FILE}. The task requires implementing "
        "src/store.ts exporting createVersionedStore."
    )

    os.makedirs(FINAL_DIR, exist_ok=True)
    with open(SPEC_FILE, "w") as f:
        f.write(VITEST_SPEC)
    if os.path.exists(RESULT_FILE):
        os.remove(RESULT_FILE)

    proc = subprocess.run(
        [
            "npx",
            "vitest",
            "run",
            "__final__/store.final.spec.ts",
            "--environment",
            "jsdom",
            "--reporter=json",
            "--outputFile=__final__/result.json",
        ],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=os.environ.copy(),
        timeout=300,
    )

    print("===== vitest stdout =====")
    print(proc.stdout)
    print("===== vitest stderr =====")
    print(proc.stderr)

    assert os.path.isfile(RESULT_FILE), (
        "vitest did not produce a JSON result file. "
        f"Return code: {proc.returncode}. See stdout/stderr above."
    )

    with open(RESULT_FILE) as f:
        report = json.load(f)

    status_by_title = {}
    for suite in report.get("testResults", []):
        for assertion in suite.get("assertionResults", []):
            status_by_title[assertion.get("title")] = assertion.get("status")

    assert status_by_title, "No test assertions were reported by vitest."
    return status_by_title


def _assert_case(results, title):
    status = results.get(title)
    assert status is not None, f"Test case '{title}' was not executed by vitest."
    assert status == "passed", f"Test case '{title}' did not pass (status: {status})."


def test_store_module_exists():
    assert os.path.isfile(STORE_FILE), f"src/store.ts not found at {STORE_FILE}."


def test_set_get_round_trip(vitest_results):
    _assert_case(vitest_results, "set/get round-trip stores versioned envelope")


def test_missing_key_returns_null(vitest_results):
    _assert_case(vitest_results, "get returns null for missing key")


def test_migration_chain_persists_upgrade(vitest_results):
    _assert_case(vitest_results, "get migrates old payload and persists upgrade")


def test_atomic_migration_failure(vitest_results):
    _assert_case(vitest_results, "get keeps storage intact when a migration throws")


def test_newer_version_rejects(vitest_results):
    _assert_case(vitest_results, "get rejects when stored version is newer than code")


def test_remove_deletes_key(vitest_results):
    _assert_case(vitest_results, "remove deletes the key")
