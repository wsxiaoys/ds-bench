import asyncio
import json
import sys
import traceback
from semantics import build_report

async def main():
    try:
        report = await build_report()
        with open("report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print("Report written successfully.")
    except Exception as e:
        print(f"Error building report:", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
