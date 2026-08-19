import importlib.util
import sys
from pathlib import Path


AUDIT_DIRECTORY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AUDIT_DIRECTORY))
spec = importlib.util.spec_from_file_location("continue_catalog_sync", AUDIT_DIRECTORY / "continue_catalog_sync.py")
sync = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = sync
spec.loader.exec_module(sync)
