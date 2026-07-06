"""Export every Issue Tracking user in the configured collection to a JSON artifact.

Uses the Apideck Python SDK (`apideck-unify`) to page through the Issue Tracking
List Users endpoint for the collection identified by `APIDECK_ISSUE_TRACKING_COLLECTION_ID`
on the GitHub connector and persists the resulting users to ``users.json``.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from apideck_unify import Apideck
from apideck_unify.models import CollectionUser, GetCollectionUsersResponse, IssueTrackingCollectionUsersAllResponse
from apideck_unify.types import UNSET


PROJECT_DIR = Path("/home/user/myproject")
USERS_OUTPUT_PATH = PROJECT_DIR / "users.json"
LOG_OUTPUT_PATH = PROJECT_DIR / "output.log"
SERVICE_ID = "github"
PAGE_LIMIT = 200  # maximum allowed by the API for fewer round trips


def _coerce_optional(value: Any) -> Optional[str]:
    """Normalize SDK fields (UNSET / None / str) into Optional[str].

    Empty strings are treated as ``None`` so missing values render as ``null``
    in the persisted JSON artifact.
    """
    if value is None or value == UNSET:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return str(value)


def _serialize_user(user: CollectionUser) -> Dict[str, Optional[str]]:
    user_id = _coerce_optional(user.id)
    if not user_id:
        raise ValueError("Encountered a user without a non-empty id from the Apideck response")

    return {
        "id": user_id,
        "name": _coerce_optional(user.name),
        "first_name": _coerce_optional(user.first_name),
        "last_name": _coerce_optional(user.last_name),
        "email": _coerce_optional(user.email),
    }


def _extract_users(response: IssueTrackingCollectionUsersAllResponse) -> List[CollectionUser]:
    payload: Optional[GetCollectionUsersResponse] = response.get_collection_users_response
    if payload is None:
        return []
    return list(payload.data or [])


def collect_users(apideck: Apideck, collection_id: str) -> List[CollectionUser]:
    """Iterate every page of the Issue Tracking collection users endpoint."""
    users: List[CollectionUser] = []
    response: Optional[IssueTrackingCollectionUsersAllResponse] = apideck.issue_tracking.collection_users.list(
        collection_id=collection_id,
        service_id=SERVICE_ID,
        limit=PAGE_LIMIT,
    )

    while response is not None:
        users.extend(_extract_users(response))
        response = response.next()

    return users


def main() -> None:
    collection_id = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")
    if not collection_id:
        raise RuntimeError("APIDECK_ISSUE_TRACKING_COLLECTION_ID is not set")

    # The SDK REDACTED-loads APIDECK_CONSUMER_ID / APIDECK_APP_ID, but we still
    # forward the API key explicitly so the call is authenticated even if the
    # environment has not been processed by the SDK's security fallbacks.
    apideck = Apideck(
        api_key=os.environ.get("APIDECK_API_KEY"),
        consumer_id=os.environ.get("APIDECK_CONSUMER_ID"),
        app_id=os.environ.get("APIDECK_APP_ID"),
    )

    users = collect_users(apideck, collection_id)

    artifact = {
        "collection_id": collection_id,
        "service_id": SERVICE_ID,
        "users": [_serialize_user(user) for user in users],
    }

    PROJECT_DIR.mkdir(parents=True, exist_ok=True)
    USERS_OUTPUT_PATH.write_text(json.dumps(artifact, indent=2, sort_keys=True))

    LOG_OUTPUT_PATH.write_text(f"User count: {len(users)}\n")

    print(f"Exported {len(users)} users to {USERS_OUTPUT_PATH}")


if __name__ == "__main__":
    main()