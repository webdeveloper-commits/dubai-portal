import asyncio
import sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from jarvis import runner
asyncio.run(runner.run_backfill(auto=False))
