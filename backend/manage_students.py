"""
manage_students.py — Admin utility for test-account management.

Passwords in Supabase Auth are one-way hashes and cannot be read back, so to
hand working logins to real testers we RESET the password to a known value.

Usage (run from the backend/ folder):
    python manage_students.py list
        List every student account (ID number, name, email).

    python manage_students.py reset <new_password>
        Reset EVERY student's password to <new_password> and print a
        shareable login list (ID number + password).

    python manage_students.py reset <new_password> STU-2003 STU-2004
        Reset only the listed ID numbers.
"""

import sys
import requests
from services.supabase_client import supabase
from config import Config

ADMIN_URL = f"{Config.SUPABASE_URL}/auth/v1/admin/users"
HEADERS = {
    "apikey": Config.SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {Config.SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}


def get_students(only_ids=None):
    """Return student profiles, optionally filtered to a list of ID numbers."""
    q = supabase.table("profiles").select(
        "id, full_name, user_id_number, email, programme, level"
    ).eq("role", "student").order("user_id_number")
    rows = q.execute().data or []
    if only_ids:
        wanted = {i.strip().upper() for i in only_ids}
        rows = [r for r in rows if (r.get("user_id_number") or "").upper() in wanted]
    return rows


def cmd_list():
    students = get_students()
    if not students:
        print("No student accounts found.")
        return
    print(f"\n{len(students)} student account(s):\n")
    print(f"{'ID NUMBER':<12} {'NAME':<28} {'PROGRAMME / LEVEL':<26} EMAIL")
    print("-" * 90)
    for s in students:
        prog = f"{s.get('programme') or '-'} / L{s.get('level') or '-'}"
        print(f"{(s.get('user_id_number') or '-'):<12} "
              f"{(s.get('full_name') or '-'):<28} "
              f"{prog:<26} {s.get('email') or '-'}")
    print()


def cmd_reset(new_password, only_ids=None):
    if len(new_password) < 6:
        print("Password must be at least 6 characters.")
        return
    students = get_students(only_ids)
    if not students:
        print("No matching student accounts found.")
        return

    print(f"\nResetting password for {len(students)} account(s)...\n")
    ok = []
    for s in students:
        uid = s["id"]
        r = requests.put(f"{ADMIN_URL}/{uid}",
                         json={"password": new_password}, headers=HEADERS, timeout=15)
        status = "OK" if r.status_code == 200 else f"FAILED ({r.status_code})"
        print(f"  {s.get('user_id_number'):<12} {s.get('full_name'):<28} {status}")
        if r.status_code == 200:
            ok.append(s)

    print("\n" + "=" * 60)
    print("  SHAREABLE LOGINS  (give these to your testers)")
    print("=" * 60)
    print(f"  Login at: {Config.FRONTEND_URL}")
    print(f"  Password for everyone: {new_password}\n")
    print(f"  {'ID NUMBER':<12} NAME")
    print("  " + "-" * 42)
    for s in ok:
        print(f"  {s.get('user_id_number'):<12} {s.get('full_name')}")
    print()


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "list":
        cmd_list()
    elif args[0] == "reset" and len(args) >= 2:
        cmd_reset(args[1], only_ids=args[2:] or None)
    else:
        print(__doc__)
