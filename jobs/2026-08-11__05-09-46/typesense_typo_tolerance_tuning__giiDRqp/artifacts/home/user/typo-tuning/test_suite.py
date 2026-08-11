import subprocess
import json

TEST_CASES = [
    # Rule 1: Two typos on product names, exact brands
    {"q": "camra", "expected": ["3"], "desc": "1 typo in name 'camera' (len 5)"},
    {"q": "camara", "expected": ["3"], "desc": "1 typo in name 'camera' (len 6)"},
    {"q": "camaraa", "expected": ["3"], "desc": "2 typos in name 'camera' (len 7)"},
    {"q": "Logitech", "expected": ["1"], "desc": "Exact brand 'Logitech'"},
    {"q": "Logitach", "expected": [], "desc": "1 typo in brand 'Logitech' (exact brand requirement)"},
    {"q": "Nikon", "expected": ["3"], "desc": "Exact brand 'Nikon'"},
    {"q": "Nikan", "expected": [], "desc": "1 typo in brand 'Nikon' (exact brand requirement)"},

    # Rule 2: Short-token guard
    {"q": "Bax", "expected": [], "desc": "1 typo in name 'Bag' (len 3 - no typos allowed)"},
    {"q": "Bsg", "expected": [], "desc": "1 typo in name 'Bag' (len 3 - no typos allowed)"},
    {"q": "Bag", "expected": ["3", "10"], "desc": "Exact name 'Bag' (len 3)"},
    {"q": "Wifa", "expected": ["9"], "desc": "1 typo in name 'Wifi' (len 4 - 1 typo allowed)"},
    {"q": "Wifaa", "expected": [], "desc": "2 typos in name 'Wifi' (len 5 - only 1 typo allowed)"},
    {"q": "Wif", "expected": [], "desc": "1 typo in name 'Wifi' (len 3 - no typos allowed)"},

    # Rule 3: Precise token dropping
    {"q": "Anker Cable", "expected": ["5"], "desc": "Anker Cable (exact match exists, no token dropping)"},
    {"q": "Anker Mouse", "expected": ["1", "5", "6"], "desc": "Anker Mouse (no exact match, token dropping)"},
    {"q": "Nikon Bag", "expected": ["3"], "desc": "Nikon Bag (exact match exists, no token dropping)"},
    {"q": "Nikon Beach", "expected": ["3", "10"], "desc": "Nikon Beach (no exact match, token dropping)"},

    # Rule 4: Do not over-search typos
    {"q": "Charter", "expected": ["11"], "desc": "Charter (exact match exists, no typos pulled)"},
    {"q": "Charger", "expected": ["6"], "desc": "Charger (exact match exists, no typos pulled)"},

    # Rule 5: Space split/join
    {"q": "basket ball", "expected": ["7"], "desc": "Space split/join (split)"},
    {"q": "waterbottle", "expected": ["8"], "desc": "Space split/join (join)"},
]

def run_query(q):
    cmd = ["python3", "/home/user/typo-tuning/search.py", "--q", q]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        raise Exception(f"Command failed with code {res.returncode}: {res.stderr}")
    return json.loads(res.stdout.strip())

def main():
    failed = 0
    passed = 0
    for i, tc in enumerate(TEST_CASES):
        q = tc["q"]
        expected = set(tc["expected"])
        desc = tc["desc"]
        try:
            actual = set(run_query(q))
            if actual == expected:
                print(f"PASS [{i+1:02d}]: q='{q}' | {desc}")
                passed += 1
            else:
                print(f"FAIL [{i+1:02d}]: q='{q}' | {desc}")
                print(f"      Expected: {tc['expected']}")
                print(f"      Actual:   {list(actual)}")
                failed += 1
        except Exception as e:
            print(f"ERROR [{i+1:02d}]: q='{q}' | {desc}")
            print(f"      {e}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed.")

if __name__ == '__main__':
    main()
