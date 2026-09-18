#!/usr/bin/env python3
"""Uploads a local APK to the DuoScore server.

Usage:
  set DUOSCORE_SFTP_PASS=...
  python3 build/apk-upload.py [path/to/app-debug.apk]
"""
import os
import sys

import paramiko

HOST, USER = 'modali.powerpme.com', 'modali'
REMOTE = '/public_html/score/duoscore.apk'

pwd = os.environ.get('DUOSCORE_SFTP_PASS')
if not pwd:
    raise SystemExit('set DUOSCORE_SFTP_PASS first')

local = sys.argv[1] if len(sys.argv) > 1 else 'app-debug.apk'
if not os.path.isfile(local):
    raise SystemExit('local apk not found: %s' % local)

t = paramiko.Transport((HOST, 22))
t.connect(username=USER, password=pwd)
s = paramiko.SFTPClient.from_transport(t)
data = open(local, 'rb').read()
s.put(local, REMOTE)
s.close()
t.close()
print('uploaded %s -> %s (%d bytes)' % (local, REMOTE, len(data)))