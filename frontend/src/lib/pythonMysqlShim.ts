/** MySQL de práctica para el compilador del teléfono. No hay servidor: los datos viven en memoria. */
export const MYSQL_SHIM = `
import sys, types, re

_DBS = {}

def _norm(name):
    return str(name).strip().strip("\`").lower()

class _Cursor:
    def __init__(self, store):
        self.store = store
        self.rows = []
    def execute(self, sql, params=None):
        params = list(params or ())
        text = " ".join(str(sql).split())
        kind = text.split(" ", 1)[0].upper()
        if kind == "INSERT":
            self._insert(text, params)
        elif kind == "SELECT":
            self.rows = self._select(text, params)
        elif kind == "UPDATE":
            self._update(text, params)
        elif kind == "DELETE":
            self._delete(text, params)
        elif kind in ("CREATE", "DROP", "USE", "ALTER"):
            return None
        else:
            raise Exception("El compilador del teléfono acepta INSERT, SELECT, UPDATE y DELETE.")
    def fetchall(self):
        return [tuple(row) for row in self.rows]
    def fetchone(self):
        return tuple(self.rows[0]) if self.rows else None
    def close(self):
        return None
    def _table(self, name):
        key = _norm(name)
        if key not in self.store:
            self.store[key] = {"rows": [], "seq": 1}
        return self.store[key]
    def _get(self, row, col):
        for key, value in row.items():
            if key.lower() == col.lower():
                return value
        return None
    def _set(self, row, col, value):
        for key in list(row.keys()):
            if key.lower() == col.lower():
                row[key] = value
                return
        row[col] = value
    def _match(self, row, where, params):
        if not where:
            return True
        for part in re.split(r"\\s+AND\\s+", where, flags=re.I):
            found = re.match(r"([\\\`\\w]+)\\s*=\\s*%s", part.strip(), re.I)
            if not found:
                continue
            col = found.group(1).strip("\`")
            val = params.pop(0) if params else None
            if str(self._get(row, col)) != str(val):
                return False
        return True
    def _insert(self, text, params):
        found = re.match(r"INSERT\\s+INTO\\s+([\\\`\\w]+)\\s*\\(([^)]+)\\)\\s*VALUES\\s*\\(([^)]+)\\)", text, re.I)
        if not found:
            raise Exception("El INSERT debe ser: INSERT INTO tabla (campos) VALUES (%s, %s)")
        table = self._table(found.group(1))
        cols = [c.strip().strip("\`") for c in found.group(2).split(",")]
        vals = params[: found.group(3).count("%s")]
        row = {}
        for col, val in zip(cols, vals):
            row[col] = val
        if "id" not in {c.lower() for c in cols}:
            row["id"] = table["seq"]
            table["seq"] += 1
        else:
            try:
                table["seq"] = max(table["seq"], int(self._get(row, "id")) + 1)
            except Exception:
                table["seq"] += 1
        table["rows"].append(row)
    def _select(self, text, params):
        found = re.match(r"SELECT\\s+(.+?)\\s+FROM\\s+([\\\`\\w]+)(?:\\s+WHERE\\s+(.+))?$", text, re.I)
        if not found:
            raise Exception("El SELECT debe ser: SELECT campos FROM tabla")
        table = self._table(found.group(2))
        spec = found.group(1).strip()
        if spec == "*":
            cols = list(table["rows"][0].keys()) if table["rows"] else ["id"]
        else:
            cols = [c.strip().strip("\`") for c in spec.split(",")]
        out = []
        for row in table["rows"]:
            if self._match(row, found.group(3), list(params)):
                out.append([self._get(row, col) for col in cols])
        return out
    def _update(self, text, params):
        found = re.match(r"UPDATE\\s+([\\\`\\w]+)\\s+SET\\s+(.+?)(?:\\s+WHERE\\s+(.+))?$", text, re.I)
        if not found:
            raise Exception("El UPDATE debe ser: UPDATE tabla SET campo=%s WHERE campo=%s")
        table = self._table(found.group(1))
        cols = []
        for part in found.group(2).split(","):
            item = re.match(r"([\\\`\\w]+)\\s*=\\s*%s", part.strip(), re.I)
            if item:
                cols.append(item.group(1).strip("\`"))
        values = params[: len(cols)]
        where_values = params[len(cols) :]
        for row in table["rows"]:
            if self._match(row, found.group(3), list(where_values)):
                for col, val in zip(cols, values):
                    self._set(row, col, val)
    def _delete(self, text, params):
        found = re.match(r"DELETE\\s+FROM\\s+([\\\`\\w]+)(?:\\s+WHERE\\s+(.+))?$", text, re.I)
        if not found:
            raise Exception("El DELETE debe ser: DELETE FROM tabla WHERE campo=%s")
        table = self._table(found.group(1))
        table["rows"] = [row for row in table["rows"] if not self._match(row, found.group(2), list(params))]

class _Connection:
    def __init__(self, database):
        key = _norm(database or "302")
        if key not in _DBS:
            _DBS[key] = {}
        self.store = _DBS[key]
    def cursor(self):
        return _Cursor(self.store)
    def commit(self):
        return None
    def rollback(self):
        return None
    def close(self):
        return None

def _connect(host=None, user=None, password=None, database=None, **kw):
    return _Connection(database or kw.get("db") or "302")

connector = types.ModuleType("mysql.connector")
connector.connect = _connect
connector.Error = Exception
mysql = types.ModuleType("mysql")
mysql.connector = connector
sys.modules["mysql"] = mysql
sys.modules["mysql.connector"] = connector
`;
