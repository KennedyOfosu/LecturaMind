"""
supabase_client.py — Initialises and exposes a single Supabase client instance.
Import `supabase` from this module wherever database access is needed.
"""

from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from config import Config

# Keep this client dedicated to privileged database and storage operations.
# Supabase Auth sign-in mutates its own client Authorization header to the
# signed-in user's JWT; never perform user sign-ins on this shared DB client.
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)


def create_auth_client() -> Client:
    """Return an isolated client for one Auth operation/request."""
    options = ClientOptions(auto_refresh_token=False, persist_session=False)
    return create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY, options)
