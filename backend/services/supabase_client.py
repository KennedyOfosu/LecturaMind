"""
supabase_client.py — Initialises and exposes a single Supabase client instance.
Import `supabase` from this module wherever database access is needed.
"""

from supabase import create_client, Client
from config import Config

supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)
