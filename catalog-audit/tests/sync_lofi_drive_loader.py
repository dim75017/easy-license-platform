from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import sys


SOURCE = Path(__file__).resolve().parents[1] / "sync_lofi_drive.py"
SPEC = spec_from_file_location("sync_lofi_drive", SOURCE)
assert SPEC and SPEC.loader
sync = module_from_spec(SPEC)
sys.modules[SPEC.name] = sync
SPEC.loader.exec_module(sync)
