import os
import time
import datetime
import pyarrow as pa
import lancedb

class TombstoneStore:
    def __init__(self, table_name, db_path="/home/user/myproject/lancedb_data"):
        self.table_name = table_name
        self.db_path = db_path
        os.makedirs(db_path, exist_ok=True)
        self.db = lancedb.connect(db_path)
        self.schema = pa.schema([
            pa.field("id", pa.int64()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), 16)),
            pa.field("deleted", pa.bool_()),
            pa.field("deleted_at", pa.int64())
        ])
        if table_name in self.db.table_names():
            self.table = self.db.open_table(table_name)
        else:
            self.table = None

    def add_documents(self, docs):
        """
        docs is a list of dicts, each with keys id, text, and vector (a 16-element list of floats).
        The first call creates the table with every row initialized to deleted = False and deleted_at = 0;
        subsequent calls append rows to the same table (they must accumulate, not overwrite).
        """
        if not docs:
            return

        # Double check if table was created by another instance in the meantime
        if self.table is None and self.table_name in self.db.table_names():
            self.table = self.db.open_table(self.table_name)

        # Prepare records with default tombstone column values
        pylist = []
        for doc in docs:
            pylist.append({
                "id": doc["id"],
                "text": doc["text"],
                "vector": doc["vector"],
                "deleted": False,
                "deleted_at": 0
            })

        arrow_table = pa.Table.from_pylist(pylist, schema=self.schema)

        if self.table is None:
            # First call: create table
            self.table = self.db.create_table(self.table_name, data=arrow_table)
        else:
            # Subsequent calls: append
            self.table.add(arrow_table)

    def soft_delete(self, ids):
        """
        tombstone the given ids by setting deleted = True and stamping deleted_at with the current Unix epoch seconds.
        The rows must remain physically present. Return the number of rows changed.
        """
        if not ids:
            return 0

        if self.table is None:
            if self.table_name in self.db.table_names():
                self.table = self.db.open_table(self.table_name)
            else:
                return 0

        current_time = int(time.time())
        id_str = ",".join(str(i) for i in ids)
        where_clause = f"id IN ({id_str})"

        res = self.table.update(where=where_clause, values={"deleted": True, "deleted_at": current_time})
        return res.rows_updated

    def restore(self, ids):
        """
        only for ids that are currently tombstoned, clear the tombstone by setting deleted = False and deleted_at = 0.
        Return the number of rows changed.
        """
        if not ids:
            return 0

        if self.table is None:
            if self.table_name in self.db.table_names():
                self.table = self.db.open_table(self.table_name)
            else:
                return 0

        id_str = ",".join(str(i) for i in ids)
        where_clause = f"id IN ({id_str}) AND deleted = true"

        res = self.table.update(where=where_clause, values={"deleted": False, "deleted_at": 0})
        return res.rows_updated

    def search(self, query_vector, k):
        """
        run an L2 nearest-neighbour search for the given 16-dimensional query vector,
        transparently excluding tombstoned rows using a prefilter, and return at most k results.
        Each result must be a dict with exactly the keys id, text, and distance,
        ordered by ascending distance and breaking ties by ascending id.
        """
        if self.table is None:
            if self.table_name in self.db.table_names():
                self.table = self.db.open_table(self.table_name)
            else:
                return []

        raw_results = self.table.search(query_vector).metric("l2").where("deleted = false").limit(k).to_list()

        results = []
        for r in raw_results:
            results.append({
                "id": r["id"],
                "text": r["text"],
                "distance": r["_distance"]
            })

        # Sort by distance ascending, and break ties by id ascending
        results.sort(key=lambda x: (x["distance"], x["id"]))
        return results[:k]

    def gc(self, older_than_seconds):
        """
        permanently remove rows whose tombstone has aged — those with deleted = True and deleted_at > 0
        and deleted_at older than older_than_seconds before the current time — then compact table fragments
        and prune obsolete table versions so that disk space is reclaimed in the same pass.
        Live rows and non-aged tombstones must be left untouched. Return the number of rows hard-deleted.
        """
        if self.table is None:
            if self.table_name in self.db.table_names():
                self.table = self.db.open_table(self.table_name)
            else:
                return 0

        current_time = int(time.time())
        cutoff_time = current_time - older_than_seconds

        where_clause = f"deleted = true AND deleted_at > 0 AND deleted_at < {cutoff_time}"

        # Count matching rows before deleting
        matching_rows = self.table.search().where(where_clause).to_arrow()
        num_deleted = len(matching_rows)

        if num_deleted > 0:
            self.table.delete(where_clause)

        # Compact table fragments and prune obsolete table versions
        # Using optimize() with cleanup_older_than=0 days and delete_unverified=True to reclaim disk space immediately
        self.table.optimize(cleanup_older_than=datetime.timedelta(seconds=0), delete_unverified=True)

        return num_deleted
