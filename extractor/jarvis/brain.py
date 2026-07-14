import logging
import anthropic
from .config import ANTHROPIC_KEY

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

SYSTEM_PROMPT = """You are JARVIS, the AI content and publishing assistant for Elysian Real Estate's Dubai property portal (propsale.co).

Your job:
- Tuesday runs: Scan opr.ae for new off-plan projects → scrape text → find images from developer websites → publish to Supabase → write blog posts from Google Sheet topics
- Friday runs: Generate area guides from Bayut.com → create developer profiles from Google Sheet → publish

Rules you always follow:
- Check for duplicates before publishing anything
- Never crash silently — always report errors in plain English via Telegram
- Self-heal: retry failed steps 3x before giving up, switch to fallback sources if primary is blocked
- Learn from failures: log what failed and how you fixed it so you don't repeat the same mistake
- Content goes live on website FIRST (is_published=true), Google only after human APPROVE
- Send progress updates every 3 items, not every single one
- Be concise in all Telegram messages

When someone says APPROVE ALL — call ping_google for all pending items.
When someone says APPROVE 1,3 — ping Google only for those numbered items.
When someone says FIX 2 [description] — fix that specific item and re-send the preview link.

You communicate only through Telegram. Keep messages short and clear."""

# In-memory conversation history per chat ID (last 20 messages)
_history: dict[int, list] = {}


def chat(chat_id: int, user_message: str) -> str:
    if chat_id not in _history:
        _history[chat_id] = []

    _history[chat_id].append({"role": "user", "content": user_message})

    if len(_history[chat_id]) > 20:
        _history[chat_id] = _history[chat_id][-20:]

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=_history[chat_id],
        )
        reply = response.content[0].text
        _history[chat_id].append({"role": "assistant", "content": reply})
        return reply

    except anthropic.APIConnectionError:
        return "Cannot reach Claude API — check server internet connection."
    except anthropic.RateLimitError:
        return "Claude API rate limit hit. Try again in a minute."
    except Exception as e:
        logger.error(f"Brain error: {e}")
        return f"Claude error: {e}"


def clear_history(chat_id: int) -> None:
    _history.pop(chat_id, None)
