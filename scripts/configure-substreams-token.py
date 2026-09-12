#!/usr/bin/env python3
"""Save a Graph Market JWT locally without echoing or putting it in shell history."""
import getpass
import os
import sys
from pathlib import Path

if not sys.stdin.isatty():
    raise SystemExit("Run this script yourself in an interactive terminal.")
root = Path(__file__).resolve().parents[1]
secret_dir = root / ".secrets"
secret_dir.mkdir(mode=0o700, exist_ok=True)
secret_dir.chmod(0o700)
token = getpass.getpass("Paste Graph Market API Token (JWT, hidden): ").strip()
if len(token.split(".")) != 3 or any(c.isspace() for c in token):
    raise SystemExit("Expected a JWT with three dot-separated parts; nothing saved.")
target = secret_dir / "substreams-token"
flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW
fd = os.open(target, flags, 0o600)
with os.fdopen(fd, "w") as output:
    os.fchmod(output.fileno(), 0o600)
    output.write(token + "\n")
print("Token saved locally with owner-only permissions. Token value was not printed.")
