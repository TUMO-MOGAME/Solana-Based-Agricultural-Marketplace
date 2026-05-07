"""
Switchboard probe.

Question: Does Switchboard have rainfall feeds we can use, or is it a
build-your-own-oracle platform (in which case "use Switchboard" is the
same as "build a custom oracle, just on their infrastructure")?

Run: python spikes/oracle-check/probe_switchboard.py
"""

import json
import urllib.error
import urllib.request

ENDPOINTS = [
    ("crossbar health",       "https://crossbar.switchboard.xyz/health"),
    ("crossbar root",         "https://crossbar.switchboard.xyz/"),
    ("ondemand mainnet idl",  "https://crossbar.switchboard.xyz/idl/mainnet"),
    ("queue listing (mainnet)", "https://crossbar.switchboard.xyz/queues/mainnet"),
]


def probe(label, url):
    print(f"\n>>> {label}: {url}")
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "vuna-oracle-spike/0.1",
                     "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            ct = resp.headers.get("Content-Type", "")
            body = resp.read(4096)
            print(f"    HTTP {resp.status}  {ct}")
            text = body.decode("utf-8", errors="replace")
            try:
                parsed = json.loads(text)
                # Print a compact preview
                preview = json.dumps(parsed, indent=2)
                print("    " + preview.replace("\n", "\n    ")[:700])
            except json.JSONDecodeError:
                print("    " + text[:400].replace("\n", "\n    "))
    except urllib.error.HTTPError as e:
        print(f"    HTTP {e.code}  {e.reason}")
    except urllib.error.URLError as e:
        print(f"    URL error: {e.reason}")
    except Exception as e:
        print(f"    error: {e}")


def main():
    for label, url in ENDPOINTS:
        probe(label, url)
    print("\n" + "=" * 60)
    print("Reminder: Switchboard's model is 'build your own feed'.")
    print("There is no central catalog of weather feeds the way Pyth")
    print("has a price catalog. If we 'use Switchboard for weather'")
    print("we are still writing the data ingestion ourselves — we just")
    print("publish through Switchboard's infrastructure instead of our own.")


if __name__ == "__main__":
    main()
