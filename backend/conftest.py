"""Pytest root conftest — adds backend/ to sys.path so 'app.*' imports work."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# Tests use the template fallback instead of a live model, so they are fast and
# deterministic. Set DATEPILOT_LIVE_LLM=1 to run them against the real Ollama.
if not os.getenv("DATEPILOT_LIVE_LLM"):
    os.environ["OLLAMA_BASE_URL"] = "http://127.0.0.1:9"
    os.environ["OPENAI_BASE_URL"] = ""
