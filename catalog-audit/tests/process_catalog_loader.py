"""Load the catalogue processor from the hyphenated audit directory."""

import importlib.util
import sys
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "process_catalog.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("symbiome_catalog_process", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {MODULE_PATH}")
process = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = process
SPEC.loader.exec_module(process)
