import json
import math
import os
import re
import subprocess
from pathlib import Path

import pytest


PROJECT_DIR = "/home/user/myproject"
PLAYER_GD = os.path.join(PROJECT_DIR, "player.gd")
MAIN_GD = os.path.join(PROJECT_DIR, "main.gd")
PROJECT_GODOT = os.path.join(PROJECT_DIR, "project.godot")
PLAYER_TSCN = os.path.join(PROJECT_DIR, "player.tscn")
MAIN_TSCN = os.path.join(PROJECT_DIR, "main.tscn")


def _run_lobby(port: int, deltas, out_path: str, frames: int = 240, clients: int = 2, timeout: int = 60):
    if os.path.exists(out_path):
        os.remove(out_path)
    delta_csv = ",".join(str(d) for d in deltas)
    cmd = [
        "godot",
        "--headless",
        "--path",
        PROJECT_DIR,
        "res://main.tscn",
        "--",
        f"--port={port}",
        f"--clients={clients}",
        f"--frames={frames}",
        f"--score-deltas={delta_csv}",
        f"--out={out_path}",
    ]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return result


def _load_result(out_path: str):
    assert os.path.isfile(out_path), f"Expected lobby result JSON at {out_path}."
    with open(out_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Scaffold checks
# ---------------------------------------------------------------------------

def test_required_files_exist():
    for path in [PROJECT_GODOT, MAIN_TSCN, MAIN_GD, PLAYER_TSCN, PLAYER_GD]:
        assert os.path.isfile(path), f"Required file is missing: {path}"


def test_player_script_declares_required_rpc():
    text = Path(PLAYER_GD).read_text(encoding="utf-8")
    # Required exact annotation
    annotation_pattern = re.compile(
        r'@rpc\(\s*"any_peer"\s*,\s*"call_local"\s*(?:,\s*"[^\"]+"\s*)*\)'
    )
    assert annotation_pattern.search(text), (
        "player.gd must annotate update_score with `@rpc(\"any_peer\", \"call_local\")` "
        "(extra optional flags allowed)."
    )
    # Required exact signature
    signature_pattern = re.compile(
        r"func\s+update_score\s*\(\s*value\s*:\s*int\s*\)"
    )
    assert signature_pattern.search(text), (
        "player.gd must define `func update_score(value: int)`."
    )


# ---------------------------------------------------------------------------
# End-to-end lobby execution
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def primary_run():
    out_path = "/tmp/result.json"
    result = _run_lobby(port=27015, deltas=[7, 13], out_path=out_path, frames=240)
    assert result.returncode == 0, (
        f"Godot lobby run failed with status {result.returncode}.\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    data = _load_result(out_path)
    return data, [7, 13]


def test_top_level_shape(primary_run):
    data, _ = primary_run
    assert set(data.keys()) == {"server", "clients"}, (
        f"Top-level keys must be exactly server/clients, got {sorted(data.keys())}"
    )


def test_server_unique_id_is_one(primary_run):
    data, _ = primary_run
    assert data["server"]["unique_id"] == 1, (
        f"Server unique id must be 1, got {data['server']['unique_id']}"
    )


def test_two_clients_returned(primary_run):
    data, _ = primary_run
    assert len(data["clients"]) == 2, (
        f"Expected 2 clients in result, got {len(data['clients'])}"
    )


def test_client_ids_distinct_and_above_one(primary_run):
    data, _ = primary_run
    client_ids = [c["unique_id"] for c in data["clients"]]
    assert all(cid > 1 for cid in client_ids), (
        f"All client unique ids must be > 1, got {client_ids}"
    )
    assert len(set(client_ids)) == len(client_ids), (
        f"Client unique ids must be distinct, got {client_ids}"
    )


def test_server_peers_match_client_ids(primary_run):
    data, _ = primary_run
    expected = sorted(c["unique_id"] for c in data["clients"])
    assert sorted(data["server"]["peers"]) == expected, (
        f"server.peers {sorted(data['server']['peers'])} should equal sorted client ids {expected}."
    )


def test_each_client_sees_other_peers(primary_run):
    data, _ = primary_run
    all_client_ids = [c["unique_id"] for c in data["clients"]]
    for client in data["clients"]:
        expected = sorted([1] + [cid for cid in all_client_ids if cid != client["unique_id"]])
        assert sorted(client["peers"]) == expected, (
            f"Client {client['unique_id']}.peers {sorted(client['peers'])} should equal {expected}."
        )


def test_player_keys_consistent(primary_run):
    data, _ = primary_run
    expected_keys = {"1"} | {str(c["unique_id"]) for c in data["clients"]}
    assert set(data["server"]["players"].keys()) == expected_keys, (
        f"server.players keys {sorted(data['server']['players'].keys())} != expected {sorted(expected_keys)}"
    )
    for client in data["clients"]:
        assert set(client["players"].keys()) == expected_keys, (
            f"Client {client['unique_id']}.players keys {sorted(client['players'].keys())} "
            f"!= expected {sorted(expected_keys)}"
        )


def test_authority_matches_key(primary_run):
    data, _ = primary_run
    for view_name, view in [("server", data["server"])] + [
        (f"client_{c['unique_id']}", c) for c in data["clients"]
    ]:
        for key, player in view["players"].items():
            assert player["authority"] == int(key), (
                f"In {view_name}, player {key}.authority should be {int(key)} but is {player['authority']}"
            )


def test_position_equals_authority(primary_run):
    data, _ = primary_run
    for view_name, view in [("server", data["server"])] + [
        (f"client_{c['unique_id']}", c) for c in data["clients"]
    ]:
        for key, player in view["players"].items():
            pos = player["position"]
            expected = float(int(key))
            # Godot's Vector2 stores 32-bit floats, so very large peer IDs lose
            # precision. Allow a generous relative tolerance (with a small absolute
            # floor for small expected values such as the host id of 1).
            tol = max(abs(expected) * 1e-4, 1.0)
            assert isinstance(pos, list) and len(pos) == 2, (
                f"In {view_name}, player {key}.position must be a 2-element list, got {pos}"
            )
            assert abs(pos[0] - expected) <= tol and abs(pos[1] - expected) <= tol, (
                f"In {view_name}, player {key}.position should be approximately "
                f"[{expected}, {expected}] (tol={tol}) but is {pos}"
            )


def test_score_propagation(primary_run):
    data, deltas = primary_run
    ordered_clients = data["clients"]
    expected = {
        "1": 0,
        str(ordered_clients[0]["unique_id"]): deltas[0],
        str(ordered_clients[1]["unique_id"]): deltas[1],
    }
    for view_name, view in [("server", data["server"])] + [
        (f"client_{c['unique_id']}", c) for c in ordered_clients
    ]:
        for key, expected_score in expected.items():
            actual = view["players"][key]["score"]
            assert actual == expected_score, (
                f"In {view_name}, player {key}.score should be {expected_score} but is {actual}"
            )


def test_rerun_with_different_deltas():
    out_path = "/tmp/result2.json"
    result = _run_lobby(port=27016, deltas=[-2, 5], out_path=out_path, frames=240)
    assert result.returncode == 0, (
        f"Godot rerun failed with status {result.returncode}.\n"
        f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    data = _load_result(out_path)
    ordered_clients = data["clients"]
    assert len(ordered_clients) == 2, f"Expected 2 clients on rerun, got {len(ordered_clients)}"
    expected = {
        "1": 0,
        str(ordered_clients[0]["unique_id"]): -2,
        str(ordered_clients[1]["unique_id"]): 5,
    }
    for view_name, view in [("server", data["server"])] + [
        (f"client_{c['unique_id']}", c) for c in ordered_clients
    ]:
        for key, expected_score in expected.items():
            actual = view["players"][key]["score"]
            assert actual == expected_score, (
                f"Rerun: in {view_name}, player {key}.score should be {expected_score} but is {actual}"
            )
