"""Pytest root conftest — adds backend/ to sys.path so 'app.*' imports work."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
