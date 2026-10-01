import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="humanchess-test-")
os.environ.setdefault("HCHESS_DB", os.path.join(_tmp, "test.db"))
os.environ.setdefault("HCHESS_BOT_THINK_SCALE", "0")
