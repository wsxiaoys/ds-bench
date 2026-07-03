#!/usr/bin/env python3
"""Export all Issue Tracking collection users to a JSON artifact using the Apideck SDK."""

import json
import os
import sys

from apideck_unify import Apideck
from apideck_unify.types import UNSET


def _str_or_none(value) -> str | None:
    """Return the value as a string, or None if it is unset/None/empty."""
    if value is None or value is UNSET:
        return None
    s = str(value)
    return s if s.strip() != "" else None


def main() -> None:
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")

    missing = [
        name
        for name, val in [
            ("APIDECK_API_KEY", api_key),
            ("APIDECK_APP_ID", app_id),
            ("APIDECK_CONSUMER_ID", consumer_id),
            ("APIDECK_ISSUE_TRACKING_COLLECTION_ID", collection_id),
        ]
        if not val
    ]
    if missing:
        print(f"Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    service_id = "github"

    apideck = Apideck(
        api_key=api_key,
        consumer_id=consumer_id,
        app_id=app_id,
    )

    all_users: list[dict] = []

    response = apideck.issue_tracking.collection_users.list(
        collection_id=collection_id,
        service_id=service_id,
        consumer_id=consumer_id,
        app_id=app_id,
        limit=200,
    )

    while response is not None:
        body = response.get_collection_users_response
        if body is not None and body.data is not None:
            for user in body.data:
                uid = _str_or_none(user.id)
                if not uid:
                    # Skip entries without a non-empty id; requirement says id must be non-empty
                    continue
                all_users.append(
                    {
                        "id": uid,
                        "name": _str_or_none(user.name),
                        "first_name": _str_or_none(user.first_name),
                        "last_name": _str_or_none(user.last_name),
                        "email": _str_or_none(user.email),
                    }
                )

        response = response.next()

    output = {
        "collection_id": collection_id,
        "service_id": service_id,
        "users": all_users,
    }

    project_dir = "/home/user/myproject"
    json_path = os.path.join(project_dir, "users.json")
    log_path = os.path.join(project_dir, "output.log")

    with open(json_path, "w") as f:
        json.dump(output, f, indent=2)

    with open(log_path, "w") as f:
        f.write(f"User count: {len(all_users)}\n")

    print(f"Collected {len(all_users)} users -> {json_path}")
    print(f"Log written -> {log_path}")


if __name__ == "__main__":
    main()