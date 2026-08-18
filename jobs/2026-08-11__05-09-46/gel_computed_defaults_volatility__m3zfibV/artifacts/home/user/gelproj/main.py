import asyncio
import json
import os
import sys
from semantics import build_report

def main():
    try:
        report = asyncio.run(build_report())
        report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print("Report written successfully.")
        sys.exit(0)
    except Exception as e:
        print(f"Error running report: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
