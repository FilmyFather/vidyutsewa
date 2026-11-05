Headless end-to-end runs of the New Application flow against tests/mock/server.py (never against the real site).

Browser (needs playwright + chromium): start `python3 tests/mock/server.py 8099 society` and `... 8098 resident`, serve web/ on :8090, then
`python3 tests/e2e/e2e_browser.py <project dir> <out dir> society|resident`.

Electron (real desktop app, hidden-window driver): start the mock with TLS on :8443 (`server.py 8443 resident tls <cert+key pem for CN wss.mahadiscom.in>`), run
`electron desktop --remote-debugging-port=9333 --ignore-certificate-errors --host-resolver-rules='MAP wss.mahadiscom.in 127.0.0.1:8443' --user-data-dir=/tmp/ud`
and then `python3 tests/e2e/e2e_electron.py <project dir> <out dir> resident`.
