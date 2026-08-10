import os
import socket

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
PORT = 34517
# Connect over IPv4 explicitly first. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); we also keep `localhost` as a fallback in case the app
# bound only the IPv6 loopback.
CANDIDATE_HOSTS = ["127.0.0.1", "localhost"]
BROWSER_BASE_URL = f"http://localhost:{PORT}"

DB_FILES = [
    os.path.join(PROJECT_DIR, "data", "kanban.sqlite"),
    os.path.join(PROJECT_DIR, "data", "kanban.sqlite-wal"),
    os.path.join(PROJECT_DIR, "data", "kanban.sqlite-shm"),
]

SEED_TITLES = {
    "Write project spec",
    "Design database schema",
    "Set up CI pipeline",
    "Implement board UI",
    "Wire up server functions",
    "Kickoff meeting",
}

EXPECTED_COLUMNS = [
    ("todo", "Todo"),
    ("in-progress", "In Progress"),
    ("done", "Done"),
]

MOVED_CARD_TITLE = "Write project spec"


def _board_url(host):
    return f"http://{host}:{PORT}/api/board"


def fetch_board():
    """GET /api/board trying candidate hosts; returns parsed JSON."""
    last_err = None
    for host in CANDIDATE_HOSTS:
        try:
            resp = requests.get(_board_url(host), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:  # noqa: BLE001
            last_err = e
            continue
    raise AssertionError(f"Could not GET /api/board on any host {CANDIDATE_HOSTS}: {last_err}")


def cards_by_column(board):
    """Return dict[column_id] -> list of card dicts (as returned, order preserved)."""
    result = {}
    for col in board["columns"]:
        result[col["id"]] = col["cards"]
    return result


def all_titles(board):
    titles = []
    for col in board["columns"]:
        for card in col["cards"]:
            titles.append(card["title"])
    return titles


def assert_structure_and_integrity(board):
    assert isinstance(board, dict), f"Board response must be a JSON object, got {type(board)}"
    assert "columns" in board, "Board response missing 'columns' key"
    columns = board["columns"]
    assert isinstance(columns, list), "'columns' must be a list"
    assert len(columns) == 3, f"Expected exactly 3 columns, got {len(columns)}"

    for idx, (exp_id, exp_title) in enumerate(EXPECTED_COLUMNS):
        col = columns[idx]
        assert col.get("id") == exp_id, (
            f"Column at index {idx} must have id '{exp_id}', got '{col.get('id')}'"
        )
        assert col.get("title") == exp_title, (
            f"Column '{exp_id}' must have title '{exp_title}', got '{col.get('title')}'"
        )
        cards = col.get("cards")
        assert isinstance(cards, list), f"Column '{exp_id}' 'cards' must be a list"
        positions = []
        for card in cards:
            assert set(card.keys()) == {"id", "title", "position"}, (
                f"Card in column '{exp_id}' must have exactly keys id/title/position, got {sorted(card.keys())}"
            )
            assert isinstance(card["id"], int) and not isinstance(card["id"], bool), (
                f"Card 'id' must be an integer, got {card['id']!r}"
            )
            assert isinstance(card["title"], str), f"Card 'title' must be a string, got {card['title']!r}"
            assert isinstance(card["position"], int) and not isinstance(card["position"], bool), (
                f"Card 'position' must be an integer, got {card['position']!r}"
            )
            positions.append(card["position"])
        assert positions == list(range(len(cards))), (
            f"Column '{exp_id}' positions must be contiguous zero-based (0..{len(cards) - 1}) "
            f"in ascending order, got {positions}"
        )


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    # Reset persisted state so seeding is deterministic for this run.
    for path in DB_FILES:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except OSError as e:
            print(f"Warning: could not remove {path}: {e}")

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            # Port must be open on at least one candidate host.
            port_open = False
            for host in CANDIDATE_HOSTS:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    if s.connect_ex(("127.0.0.1" if host == "127.0.0.1" else "localhost", PORT)) == 0:
                        port_open = True
                        break
            if not port_open:
                return False
            # Confirm the board endpoint actually responds (first request may build).
            for host in CANDIDATE_HOSTS:
                try:
                    resp = requests.get(_board_url(host), timeout=30)
                    if resp.status_code < 500:
                        return True
                except requests.RequestException:
                    continue
            return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        printed_log_lines = len(all_lines)
        print(f"===================== [{tag}: Begin] {Starter.name} log =====================")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} log =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_seed_and_read_contract(start_app):
    """GET /api/board returns the seeded board with the exact structure and integrity invariant."""
    board = fetch_board()
    assert_structure_and_integrity(board)

    titles = all_titles(board)
    assert len(titles) == len(SEED_TITLES), f"Expected {len(SEED_TITLES)} cards, got {len(titles)}: {titles}"
    assert set(titles) == SEED_TITLES, f"Card titles must equal the seed set. Got {sorted(titles)}"

    by_col = cards_by_column(board)
    todo_titles = [c["title"] for c in by_col["todo"]]
    inprog_titles = [c["title"] for c in by_col["in-progress"]]
    assert MOVED_CARD_TITLE in todo_titles, (
        f"Seed expects '{MOVED_CARD_TITLE}' in the 'todo' column, got {todo_titles}"
    )
    assert MOVED_CARD_TITLE not in inprog_titles, (
        f"Seed expects '{MOVED_CARD_TITLE}' NOT in the 'in-progress' column, got {inprog_titles}"
    )


def test_render_and_drag_across_columns(start_app, browser_verifier):
    reason = (
        "The Kanban board must render three columns (Todo, In Progress, Done) with draggable cards, "
        "and dragging a card to a different column must persist across a full page reload."
    )
    truth = (
        f"Navigate to {BROWSER_BASE_URL}. "
        "Verify the page shows three columns titled 'Todo', 'In Progress', and 'Done'. "
        "Verify a card labeled 'Write project spec' is shown under the 'Todo' column. "
        "Drag the card labeled 'Write project spec' from the 'Todo' column and drop it into the 'In Progress' column. "
        "Wait a moment for the change to save. "
        f"Then reload the page by navigating to {BROWSER_BASE_URL} again. "
        "After the reload, verify that the card labeled 'Write project spec' now appears under the 'In Progress' column "
        "and no longer appears under the 'Todo' column."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_render_and_drag_across_columns",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_move_persisted_and_order_integrity(start_app):
    """After the drag+reload, the server must reflect the cross-column move and keep order integrity."""
    board = fetch_board()
    assert_structure_and_integrity(board)

    titles = all_titles(board)
    assert set(titles) == SEED_TITLES, (
        f"All 6 seed titles must still be present exactly once after the move. Got {sorted(titles)}"
    )
    assert len(titles) == len(SEED_TITLES), (
        f"No cards may be lost or duplicated after the move. Got {titles}"
    )

    by_col = cards_by_column(board)
    todo_titles = [c["title"] for c in by_col["todo"]]
    inprog_titles = [c["title"] for c in by_col["in-progress"]]
    assert MOVED_CARD_TITLE in inprog_titles, (
        f"After the drag, '{MOVED_CARD_TITLE}' must be persisted in the 'in-progress' column, got {inprog_titles}"
    )
    assert MOVED_CARD_TITLE not in todo_titles, (
        f"After the drag, '{MOVED_CARD_TITLE}' must no longer be in the 'todo' column, got {todo_titles}"
    )
