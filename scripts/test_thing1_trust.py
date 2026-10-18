#!/usr/bin/env python3
"""Thing 1 trust regression tests (FIX-0101 + FIX-0102).

Stdlib only so this runs in CI without installing the scientific stack. The
tests cover the existing fingerprint contract, the envelope gate, the env-only
FRED adapter, and static checks that the old exposed key and hardcoded lock
hash are gone. A guarded local integration imports limen_app.health() when the
runtime dependencies are available; it is skipped, not failed, when they are not.

RUN: python scripts/test_thing1_trust.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from python_runtime.helix_app import thing1  # noqa: E402
from python_runtime.helix_app.thing1 import fred  # noqa: E402

FAILURES = 0


def check(name, fn):
    global FAILURES
    try:
        fn()
        print("  pass: " + name)
    except Exception as exc:  # noqa: BLE001
        FAILURES += 1
        print("  FAIL: " + name + " — " + str(exc))


def with_paths(kernel_path, lock_path, fn):
    old_kernel, old_lock = thing1._KERNEL_PATH, thing1._LOCK_PATH
    thing1._KERNEL_PATH = str(kernel_path)
    thing1._LOCK_PATH = str(lock_path)
    try:
        return fn()
    finally:
        thing1._KERNEL_PATH, thing1._LOCK_PATH = old_kernel, old_lock


class FakeResponse:
    def __init__(self, observations=None, error=None):
        self._observations = observations or []
        self._error = error

    def raise_for_status(self):
        if self._error:
            raise self._error

    def json(self):
        return {"observations": self._observations}


def fake_transport(calls, observations=None, error=None):
    def transport(url, params=None, timeout=None):
        calls.append({"url": url, "params": params, "timeout": timeout})
        return FakeResponse(observations=observations, error=error)
    return transport


def main():
    print("thing1 trust")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        kernel = tmp_path / "limen_backtest.py"
        kernel.write_bytes(b"fixture kernel bytes\n")
        kernel_sha = __import__("hashlib").sha256(kernel.read_bytes()).hexdigest()
        lock = tmp_path / "VALIDATION_LOCK.json"
        other_sha = "0" * 64

        def write_lock(value):
            lock.write_text(json.dumps(value), encoding="utf-8")

        check("fingerprint: matching kernel and lock", lambda: with_paths(
            kernel, lock,
            lambda: _assert_match(write_lock, kernel_sha)))

        def match_without_evidence_case():
            write_lock({"sha256": kernel_sha})
            fp = with_paths(kernel, lock, thing1.fingerprint_status)
            assert fp["state"] == "match", fp
            assert fp["validation_evidence_present"] is False, fp
            assert thing1.validation_status_for_fingerprint(fp) == "unvalidated", fp
        check("fingerprint: match without evidence is not validated", match_without_evidence_case)

        def mismatch_case():
            write_lock({"sha256": other_sha})
            fp = with_paths(kernel, lock, thing1.fingerprint_status)
            assert fp["state"] == "mismatch", fp
            assert fp["kernel_sha256"] == kernel_sha, fp
            assert fp["lock_sha256"] == other_sha, fp
        check("fingerprint: mismatch is reported, not validated", mismatch_case)

        def no_lock_case():
            write_lock({})
            fp = with_paths(kernel, lock, thing1.fingerprint_status)
            assert fp["state"] == "no_lock", fp
            assert fp["lock_sha256"] is None, fp
            assert thing1.validation_status_for_fingerprint(fp) != "validated", fp
        check("fingerprint: missing lock entry is a hard fail", no_lock_case)

        def missing_lock_file_case():
            fp = with_paths(kernel, tmp_path / "absent-lock.json", thing1.fingerprint_status)
            assert fp["state"] == "no_lock", fp
            assert fp["lock_sha256"] is None, fp
        check("fingerprint: missing lock file is a hard fail", missing_lock_file_case)

        def malformed_lock_case():
            lock.write_text("not-json", encoding="utf-8")
            fp = with_paths(kernel, lock, thing1.fingerprint_status)
            assert fp["state"] == "no_lock", fp
        check("fingerprint: malformed lock is a hard fail", malformed_lock_case)

        def absent_kernel_case():
            write_lock({"sha256": kernel_sha})
            fp = with_paths(tmp_path / "absent-kernel.py", lock, thing1.fingerprint_status)
            assert fp["state"] == "absent", fp
            assert fp["kernel_sha256"] is None, fp
            assert thing1.validation_status_for_fingerprint(fp) == "unavailable", fp
        check("fingerprint: absent kernel is unavailable", absent_kernel_case)

    check("status map: match / mismatch / no_lock / absent", lambda: _assert_status_map())

    def envelope_match_validated():
        env = {"status": "validated", "in_envelope": True,
               "status_code": None, "disclaimer": None}
        out = thing1.apply_fingerprint_to_envelope(env, {"state": "match"})
        assert out["status"] == "validated", out
        assert out["in_envelope"] is True, out
    check("envelope: matching fingerprint preserves a validated envelope", envelope_match_validated)

    def envelope_match_unvalidated():
        env = {"status": "ingestion_suspect", "in_envelope": False,
               "status_code": "INGESTION_SUSPECT", "disclaimer": "coverage"}
        out = thing1.apply_fingerprint_to_envelope(env, {"state": "match"})
        assert out["status"] == "ingestion_suspect", out
        assert out["in_envelope"] is False, out
        assert out["disclaimer"] == "coverage", out
    check("envelope: matching fingerprint does not override a failed envelope", envelope_match_unvalidated)

    def envelope_match_missing_evidence():
        env = {"status": "validated", "in_envelope": True,
               "status_code": None, "disclaimer": None}
        fp = {"state": "match", "kernel_sha256": "a" * 64,
              "lock_sha256": "a" * 64, "validation_evidence_present": False}
        out = thing1.apply_fingerprint_to_envelope(env, fp)
        assert out["status"] == "unvalidated", out
        assert out["envelope_status_code"] == "VALIDATION_EVIDENCE_MISSING", out
        assert out["in_envelope"] is False, out
    check("envelope: matching fingerprint without evidence is not validated", envelope_match_missing_evidence)

    def envelope_mismatch():
        env = {"status": "validated", "in_envelope": True,
               "status_code": None, "disclaimer": None}
        fp = {"state": "mismatch", "kernel_sha256": "a" * 64, "lock_sha256": "b" * 64}
        out = thing1.apply_fingerprint_to_envelope(env, fp)
        assert out["status"] == "unvalidated_after_modification", out
        assert out["in_envelope"] is False, out
        assert out["envelope_status_code"] == "FINGERPRINT_MISMATCH", out
        assert "mismatch" in out["disclaimer"].lower(), out
    check("envelope: mismatch forces unvalidated and interpretive", envelope_mismatch)

    def envelope_no_lock():
        env = {"status": "validated", "in_envelope": True,
               "status_code": None, "disclaimer": None}
        fp = {"state": "no_lock", "kernel_sha256": "a" * 64, "lock_sha256": None}
        out = thing1.apply_fingerprint_to_envelope(env, fp)
        assert out["status"] == "unvalidated_after_modification", out
        assert out["envelope_status_code"] == "NO_LOCK", out
        assert out["in_envelope"] is False, out
    check("envelope: no_lock forces unvalidated", envelope_no_lock)

    def envelope_absent():
        env = {"status": "validated", "in_envelope": True,
               "status_code": None, "disclaimer": None}
        fp = {"state": "absent", "kernel_sha256": None, "lock_sha256": None}
        out = thing1.apply_fingerprint_to_envelope(env, fp)
        assert out["status"] == "unavailable", out
        assert out["envelope_status_code"] == "FINGERPRINT_UNAVAILABLE", out
    check("envelope: absent kernel is unavailable", envelope_absent)

    check("FRED: missing key raises a named failure", _assert_fred_missing)
    check("FRED: blank key raises a named failure", _assert_fred_blank)
    check("FRED: configured key is returned unchanged", _assert_fred_configured)

    def fred_missing_no_request():
        calls = []
        result = fred.fetch_quiet(fake_transport(calls), env={})
        assert result["ok"] is False, result
        assert result["reason"] == "fred-not-configured", result
        assert result["provider_called"] is False, result
        assert calls == [], "missing config must not call the transport"
    check("FRED: missing config performs no request", fred_missing_no_request)

    def fred_configured_mocked():
        calls = []
        observations = [
            {"date": "2020-01-31", "value": "1.0"},
            {"date": "2020-02-29", "value": "2.0"},
            {"date": "2020-03-31", "value": "3.0"},
            {"date": "2020-04-30", "value": "4.0"},
        ]
        result = fred.fetch_quiet(
            fake_transport(calls, observations=observations),
            env={"FRED_API_KEY": "test-fred-key"},
        )
        assert result["ok"] is True, result
        assert calls and calls[0]["params"]["api_key"] == "test-fred-key", calls
        assert calls[0]["params"]["series_id"] == "FEDFUNDS", calls
        assert result["delta"] == {(2020, 2): 2.0}, result
    check("FRED: configured access uses the injected transport and test key", fred_configured_mocked)

    def fred_transport_error_is_sanitized():
        calls = []
        result = fred.fetch_quiet(
            fake_transport(calls, error=RuntimeError("boom https://example.test?api_key=SECRET")),
            env={"FRED_API_KEY": "test-fred-key"},
        )
        assert result["ok"] is False, result
        assert result["reason"] == "fred-unavailable", result
        serialized = json.dumps(result)
        assert "SECRET" not in serialized and "api_key" not in serialized, serialized
    check("FRED: transport errors are named and do not leak the key", fred_transport_error_is_sanitized)

    check("source: no embedded FRED key literal", _assert_no_embedded_key)
    check("source: no hardcoded lock hash in the scorer", _assert_no_hardcoded_lock)
    check("consumer: report uses the server fingerprint, not a fabricated one", _assert_report_consumer)

    _local_health_integration()

    print("")
    if FAILURES:
        print(f"{FAILURES} failure(s)")
        return 1
    print("thing1 trust: all checks passed")
    return 0


def _assert_match(write_lock, kernel_sha):
    write_lock({"sha256": kernel_sha, "validation_evidence": {"pr_auc_holdout": 0.82}})
    # Re-read paths inside with_paths from the caller.
    fp = thing1.fingerprint_status()
    assert fp["state"] == "match", fp
    assert fp["kernel_sha256"] == kernel_sha, fp
    assert fp["lock_sha256"] == kernel_sha, fp
    assert fp["validation_evidence_present"] is True, fp
    assert thing1.validation_status_for_fingerprint(fp) == "validated", fp


def _assert_status_map():
    assert thing1.validation_status_for_fingerprint({"state": "match"}) == "validated"
    assert thing1.validation_status_for_fingerprint(
        {"state": "match", "validation_evidence_present": False}) == "unvalidated"
    assert thing1.validation_status_for_fingerprint({"state": "absent"}) == "unavailable"
    assert thing1.validation_status_for_fingerprint({"state": "mismatch"}) == "unvalidated_after_modification"
    assert thing1.validation_status_for_fingerprint({"state": "no_lock"}) == "unvalidated_after_modification"


def _assert_fred_missing():
    try:
        fred.api_key({})
    except fred.FredNotConfigured as exc:
        assert str(exc) == "fred-not-configured", exc
        return
    raise AssertionError("missing FRED_API_KEY did not raise FredNotConfigured")


def _assert_fred_blank():
    try:
        fred.api_key({"FRED_API_KEY": "   "})
    except fred.FredNotConfigured:
        return
    raise AssertionError("blank FRED_API_KEY did not raise FredNotConfigured")


def _assert_fred_configured():
    assert fred.api_key({"FRED_API_KEY": "test-fred-key"}) == "test-fred-key"


def _assert_no_embedded_key():
    source = (ROOT / "python_runtime/helix_app/thing1/limen_backtest.py").read_text(encoding="utf-8")
    assert not re.search(r'FRED_KEY\s*=\s*["\'][A-Fa-f0-9]{20,}["\']', source), "embedded FRED key literal remains"
    assert "fred_config.fetch_quiet" in source, "kernel must use the shared FRED adapter"


def _assert_no_hardcoded_lock():
    source = (ROOT / "python_runtime/limen_app.py").read_text(encoding="utf-8")
    assert "3ce4a652ff8af4b4ea26ad1811f5cb31f746b5abceda05470d921f6e7a482d20" not in source, "hardcoded lock hash remains"
    assert "fingerprint_status" in source, "scorer must read the fingerprint contract"
    assert "fred_status" in source, "scorer must disclose FRED availability"
    assert 'os.environ.get("FRED_API_KEY") or lbt.FRED_KEY' not in source, "FRED fallback remains"


def _assert_report_consumer():
    source = (ROOT / "helix-report.html").read_text(encoding="utf-8")
    assert "state: 'server_validated'" not in source, "fabricated server_validated fingerprint remains"
    assert "t1.fingerprint_status" in source, "report must use the server fingerprint"
    assert "kernel_sha256_actual" in source, "report must expose the actual hash"


def _local_health_integration():
    global FAILURES
    try:
        from python_runtime import limen_app
    except Exception as exc:  # noqa: BLE001
        print("  SKIP: local limen_app integration (dependencies unavailable: "
              + type(exc).__name__ + ")")
        return

    try:
        payload = limen_app.health()
        state = payload["fingerprint_status"]["state"]
        assert state in ("match", "mismatch", "no_lock", "absent"), payload
        if state != "match":
            assert payload["validation_status"] != "validated", payload
        assert payload["kernel_sha256_actual"] == payload["fingerprint_status"]["kernel_sha256"], payload
        assert payload["kernel_sha256_lock"] == payload["fingerprint_status"]["lock_sha256"], payload
        print("  pass: local limen_app.health integration (state=" + state + ")")
    except Exception as exc:  # noqa: BLE001
        FAILURES += 1
        print("  FAIL: local limen_app.health integration — " + str(exc)[:200])

    old_facts = limen_app.lbt.fetch_sec_facts
    old_sic = limen_app._fetch_sic
    old_fred = limen_app._fetch_fred_quiet
    limen_app.lbt.fetch_sec_facts = lambda cik: {"entityName": "Fixture", "facts": {}}
    limen_app._fetch_sic = lambda cik: 0
    limen_app._fetch_fred_quiet = lambda: {
        "ok": False, "reason": "fred-not-configured", "provider_called": False
    }
    try:
        try:
            limen_app.score(limen_app.ScoreRequest(cik="0000000001"))
        except Exception as exc:  # FastAPI HTTPException
            status_code = getattr(exc, "status_code", None)
            detail = getattr(exc, "detail", None)
            assert status_code == 503, (status_code, detail)
            assert detail == "fred-not-configured", detail
            print("  pass: local score endpoint refuses missing FRED config before any request")
        else:
            raise AssertionError("score did not fail closed on missing FRED config")
    except Exception as exc:  # noqa: BLE001
        FAILURES += 1
        print("  FAIL: local score FRED-config integration — " + str(exc)[:200])
    finally:
        limen_app.lbt.fetch_sec_facts = old_facts
        limen_app._fetch_sic = old_sic
        limen_app._fetch_fred_quiet = old_fred

    old = {
        "fetch_sec_facts": limen_app.lbt.fetch_sec_facts,
        "extract": limen_app.lbt.extract_quarterly_series,
        "features": limen_app.lbt.compute_all_features,
        "phases": limen_app.lbt.score_all_phases,
        "trajectory": limen_app.lbt.analyse_trajectory,
        "composite": limen_app.lbt.compute_composite_score,
        "sic": limen_app._fetch_sic,
        "fred": limen_app._fetch_fred_quiet,
        "envelope": limen_app.assess_envelope,
        "fingerprint": limen_app._thing1.fingerprint_status,
    }
    try:
        import pandas as pd

        fixture = pd.DataFrame([{
            "quarter": (2020, 1), "p3": 0.1, "recovered": False,
            "stress_accum": 0.2, "var_Revenue": 0.1, "slope_Revenue": 0.0,
            "slope_OCF": 0.0, "Cash": 10.0, "Debt": 5.0, "runway": 4.0,
        }])
        limen_app.lbt.fetch_sec_facts = lambda cik: {"entityName": "Fixture", "facts": {}}
        limen_app.lbt.extract_quarterly_series = lambda *a, **k: {
            (2020, 1): 1.0, (2020, 2): 2.0
        }
        limen_app.lbt.compute_all_features = lambda *a, **k: fixture
        limen_app.lbt.score_all_phases = lambda *a, **k: fixture
        limen_app.lbt.analyse_trajectory = lambda *a, **k: fixture
        limen_app.lbt.compute_composite_score = lambda *a, **k: (
            1.2, None,
            {"path_a": 1.2, "path_b": 0.5, "path_c": 0.4,
             "stress_rate": 0.9, "max_consec": 2,
             "cash_decline": 0.1, "rupture_n_quarters": 1},
        )
        limen_app._fetch_sic = lambda cik: 0
        limen_app._fetch_fred_quiet = lambda: {"ok": True, "reason": None, "delta": {}}
        limen_app.assess_envelope = lambda *a, **k: {
            "in_envelope": True, "status": "validated", "status_code": None,
            "regime_context": "extrapolated", "is_financial": False,
            "sic_code": 0, "disclaimer": None,
        }
        fp_fixture = {
            "state": "mismatch", "kernel_sha256": "a" * 64,
            "lock_sha256": "b" * 64, "validation_evidence_present": True,
        }
        limen_app._thing1.fingerprint_status = lambda: dict(fp_fixture)
        out = limen_app.score(limen_app.ScoreRequest(cik="0000000001"))
        assert out["validation_status"] == "unvalidated_after_modification", out
        assert out["in_envelope"] is False, out
        assert out["interpretive_only"] is True, out
        assert out["envelope_status_code"] == "FINGERPRINT_MISMATCH", out
        assert out["kernel_sha256_actual"] == "a" * 64, out
        assert out["kernel_sha256_lock"] == "b" * 64, out
        assert out["fingerprint_status"]["state"] == "mismatch", out
        assert out["fred_status"] == "configured", out
        print("  pass: local score endpoint downgrades a mismatched fingerprint")
    except Exception as exc:  # noqa: BLE001
        FAILURES += 1
        print("  FAIL: local score status integration — " + str(exc)[:300])
    finally:
        limen_app.lbt.fetch_sec_facts = old["fetch_sec_facts"]
        limen_app.lbt.extract_quarterly_series = old["extract"]
        limen_app.lbt.compute_all_features = old["features"]
        limen_app.lbt.score_all_phases = old["phases"]
        limen_app.lbt.analyse_trajectory = old["trajectory"]
        limen_app.lbt.compute_composite_score = old["composite"]
        limen_app._fetch_sic = old["sic"]
        limen_app._fetch_fred_quiet = old["fred"]
        limen_app.assess_envelope = old["envelope"]
        limen_app._thing1.fingerprint_status = old["fingerprint"]


if __name__ == "__main__":
    sys.exit(main())
