import os

TELEGRAM_TOKEN   = os.environ["TELEGRAM_TOKEN"]
ANTHROPIC_KEY    = os.environ["ANTHROPIC_KEY"]
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_KEY     = os.environ["SUPABASE_KEY"]
CLOUDINARY_CLOUD = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_KEY   = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_SECRET= os.environ.get("CLOUDINARY_API_SECRET", "")
PEXELS_KEY       = os.environ.get("PEXELS_KEY", "")

# Set this after first /start — your personal Telegram chat ID
ADMIN_CHAT_ID    = int(os.environ.get("ADMIN_CHAT_ID", "0"))

# Run schedule (UAE = UTC+4)
RUN_DAYS         = ["tuesday", "friday"]
RUN_HOUR_UAE     = 9   # 9am UAE = 5am UTC
RUN_HOUR_UTC     = 5
