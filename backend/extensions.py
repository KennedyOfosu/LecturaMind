# extensions.py – shared Flask extensions

import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize Limiter with default limits; can be overridden per route
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per day", "50 per hour"])
