import osmnx as ox
import time
import requests as _requests

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api",
    "https://overpass.openstreetmap.fr/api",
    "https://maps.mail.ru/osm/tools/overpass/api",
]

_active_endpoint = None

def _health_check(endpoint, timeout=15):
    try:
        resp = _requests.post(
            f"{endpoint}/interpreter",
            data={"data": "[out:json];node(35.0,137.0,35.001,137.001);out count;"},
            timeout=timeout,
        )
        return resp.status_code == 200
    except Exception:
        return False

def _select_endpoint():
    global _active_endpoint
    if _active_endpoint and _health_check(_active_endpoint):
        return _active_endpoint
    for ep in OVERPASS_ENDPOINTS:
        print(f"  🔍 Health check: {ep} ...", end=" ", flush=True)
        if _health_check(ep):
            print("OK")
            _active_endpoint = ep
            return ep
        print("NG")
    _active_endpoint = OVERPASS_ENDPOINTS[0]
    print(f"  ⚠️ No healthy endpoint, falling back to: {_active_endpoint}")
    return _active_endpoint

def call_with_fallback(func, *args, max_retries_per_endpoint=2, **kwargs):
    global _active_endpoint
    last_error = None

    alive = _select_endpoint()
    print(f"  ✅ Overpass endpoint selected: {alive}")
    endpoints_ordered = [alive] + [ep for ep in OVERPASS_ENDPOINTS if ep != alive]

    for endpoint in endpoints_ordered:
        ox.settings.overpass_url = endpoint
        ox.settings.overpass_rate_limit = False

        for attempt in range(max_retries_per_endpoint):
            try:
                print(f"  🌐 Overpass: {endpoint} (attempt {attempt + 1})")
                result = func(*args, **kwargs)
                _active_endpoint = endpoint
                return result
            except Exception as e:
                error_msg = str(e)
                is_connection_issue = (
                    "ConnectionError" in type(e).__name__
                    or "Timeout" in type(e).__name__
                    or "Connection refused" in error_msg
                    or "Max retries exceeded" in error_msg
                    or "timed out" in error_msg.lower()
                )
                if not is_connection_issue:
                    raise
                last_error = e
                print(f"  ⚠️ {endpoint} failed: {type(e).__name__}")
                if attempt < max_retries_per_endpoint - 1:
                    time.sleep(5)

        print(f"  ❌ {endpoint} exhausted, trying next...")

    raise last_error
