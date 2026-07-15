import logging
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from telegram import Update, BotCommand
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    filters, ContextTypes
)
from .brain import chat, clear_history
from .config import TELEGRAM_TOKEN, ADMIN_CHAT_ID, RUN_HOUR_UTC
from . import runner

logger = logging.getLogger(__name__)

# Global app reference so scheduler can send messages
_app: Application | None = None


def get_app() -> Application:
    return _app


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    await update.message.reply_text(
        f"JARVIS online.\n\n"
        f"Your Telegram chat ID: {chat_id}\n\n"
        f"Add this to your server .env file:\n"
        f"ADMIN_CHAT_ID={chat_id}\n\n"
        f"Then restart JARVIS. After that, only your account can control it."
    )


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_admin(update):
        return
    clear_history(update.effective_chat.id)
    await update.message.reply_text("Conversation cleared.")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_admin(update):
        return
    await update.message.reply_text(
        "JARVIS is running.\n"
        "Next runs: Tuesday and Friday at 9:00am UAE time.\n"
        "Send any message to talk to me."
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_admin(update):
        await update.message.reply_text("Unauthorized.")
        return

    chat_id = update.effective_chat.id
    user_text = update.message.text.strip()
    upper = user_text.upper()

    await context.bot.send_chat_action(chat_id=chat_id, action="typing")

    try:
        # ── APPROVE commands → runner ──
        if upper.startswith("APPROVE"):
            asyncio.create_task(runner.handle_approve(user_text))
            await update.message.reply_text("Processing approvals...")
            return

        # ── Stop current run ──
        if upper in ("STOP", "STOP RUN", "CANCEL"):
            if runner.stop_run():
                await update.message.reply_text("Stopping run — current project will finish, then it will halt.")
            else:
                await update.message.reply_text("No run is currently active.")
            return

        # ── Status check ──
        if upper == "STATUS":
            status = "Running" if runner.is_running() else "Idle"
            await update.message.reply_text(f"JARVIS status: {status}\nNext scheduled runs: Tuesday and Friday at 9:00am UAE time.")
            return

        # ── Manual run triggers ──
        if upper in ("RUN TUESDAY", "RUN NOW", "START TUESDAY"):
            if runner.is_running():
                await update.message.reply_text("A run is already in progress. Send STOP to cancel it first.")
                return
            await update.message.reply_text("Starting Tuesday run now...")
            asyncio.create_task(runner.run_tuesday())
            return

        if upper in ("RUN ENRICHMENT", "ENRICH"):
            if runner.is_running():
                await update.message.reply_text("A run is already in progress. Send STOP to cancel it first.")
                return
            await update.message.reply_text("Starting enrichment pass (areas + developers)...")
            asyncio.create_task(runner.run_enrichment_only())
            return

        # ── Everything else → Claude brain ──
        reply = chat(chat_id, user_text)
        for chunk in _split(reply):
            await update.message.reply_text(chunk)

    except Exception as e:
        logger.error(f"handle_message error: {e}")
        await update.message.reply_text(f"Error: {e}")


async def notify(text: str) -> None:
    """Send a message to admin — called by scheduler and tools."""
    if not _app or not ADMIN_CHAT_ID:
        logger.warning("notify() called but app or ADMIN_CHAT_ID not set")
        return
    try:
        for chunk in _split(text):
            await _app.bot.send_message(chat_id=ADMIN_CHAT_ID, text=chunk)
    except Exception as e:
        logger.error(f"notify() failed: {e}")


def _is_admin(update: Update) -> bool:
    if ADMIN_CHAT_ID == 0:
        return True  # dev mode — no restriction until ADMIN_CHAT_ID is set
    return update.effective_chat.id == ADMIN_CHAT_ID


def _split(text: str, limit: int = 4000) -> list[str]:
    return [text[i:i+limit] for i in range(0, len(text), limit)]


async def _scheduled_tuesday():
    """Called automatically by APScheduler on Tuesday and Friday at 9am UAE."""
    if runner.is_running():
        logger.info("Scheduled run skipped — a run is already active")
        return
    logger.info("Scheduled run starting...")
    asyncio.create_task(runner.run_tuesday())


async def _post_init(app: Application) -> None:
    """Start the scheduler after the event loop is running."""
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        _scheduled_tuesday,
        CronTrigger(day_of_week="tue,fri", hour=RUN_HOUR_UTC, minute=0),
    )
    scheduler.start()
    logger.info(f"Scheduler started — Tuesday and Friday at {RUN_HOUR_UTC}:00 UTC (9am UAE)")


def run() -> None:
    global _app

    logging.basicConfig(
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        level=logging.INFO,
    )

    _app = Application.builder().token(TELEGRAM_TOKEN).post_init(_post_init).build()

    # Wire notify function into runner so it can send Telegram messages
    runner.set_notify(notify)

    _app.add_handler(CommandHandler("start", cmd_start))
    _app.add_handler(CommandHandler("reset", cmd_reset))
    _app.add_handler(CommandHandler("status", cmd_status))
    _app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("JARVIS starting — polling Telegram...")
    _app.run_polling(allowed_updates=Update.ALL_TYPES)
