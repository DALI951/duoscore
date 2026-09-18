#!/usr/bin/env python3
"""DuoScore deploy — SFTP static upload to modali.powerpme.com/public_html/score/
Password from env DUOSCORE_SFTP_PASS (never hardcoded).
Usage: python deploy.py
"""
import os
import posixpath
import sys
import paramiko

HOST = "modali.powerpme.com"
USER = "modali"
REMOTE_ROOT = "/public_html/score"
FILES = [
    "index.html",
    "manifest.webmanifest",
    "icon.svg",
    "css/style.css",
    "js/score-core.js",
    "js/app.js",
    "js/sw.js",
]
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    pwd = os.environ.get("DUOSCORE_SFTP_PASS")
    if not pwd:
        print("ERROR: set DUOSCORE_SFTP_PASS first")
        sys.exit(2)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=pwd, timeout=20)
    sftp = client.open_sftp()

    # recursive mkdir for the remote path
    parts = [p for p in REMOTE_ROOT.split("/") if p]
    cur = ""
    for part in parts:
        cur = posixpath.join(cur, part)
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)

    ok, fail = 0, []
    for rel in FILES:
        src = os.path.join(HERE, rel.replace("/", os.sep))
        dst = posixpath.join(REMOTE_ROOT, rel)
        try:
            sftp.mkdir(posixpath.dirname(dst))
        except IOError:
            pass
        sftp.put(src, dst)
        size = sftp.stat(dst).st_size
        print(f"  {rel} -> {dst} ({size} B)")
        ok += 1

    sftp.close()
    client.close()
    print(f"deployed {ok} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())