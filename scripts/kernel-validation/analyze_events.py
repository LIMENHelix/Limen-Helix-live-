#!/usr/bin/env python3
"""
ANALYZE 8-K event frequency BEFORE wiring (operator: don't fix-for-100%; check if
P1/P7 is a recurring missing-influence or a rare edge that risks 2-forward-3-back).

8-K item codes (in SEC submissions data):
  2.01 = Completion of Acquisition or Disposition of Assets  -> P1 (acq) / P7 (disp)
  5.01 = Changes in Control of Registrant                    -> P1 (control change)
  1.01/1.02 = Entry/Termination of a Material Definitive Agreement
Form 10-12B = registration of a SPUN entity                  -> P7 (spinoff)

Counts these per company over its filing history to quantify how OFTEN P1/P7 events
actually happen -> is wiring the event layer a general fix or an edge case?
"""
import json
import urllib.request
import time

COS = [
    ("OXY", "0000797468"), ("INTC", "0000050863"), ("TSLA", "0001318605"),
    ("AAPL", "0000320193"), ("HON", "0000773840"), ("VLO", "0001035002"),
    ("GILD", "0000882095"), ("MU", "0000723125"), ("ADBE", "0000796343"),
    ("BBY", "0000764478"), ("DELL", "0001571996"), ("MRK", "0000310158"),
    ("CL", "0000021665"), ("TJX", "0000109198"), ("M", "0000794367"),
    ("CSCO", "0000858877"), ("WMT", "0000104169"), ("KO", "0000021344"),
    ("GE", "0000040545"), ("MMM", "0000066740"),
]


def fetch(cik):
    url = "https://data.sec.gov/submissions/CIK%s.json" % str(cik).zfill(10)
    req = urllib.request.Request(url, headers={"User-Agent": "research research@example.com"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def main():
    print("8-K structural-event frequency (per company, recent filing history)\n")
    print("%-6s %-7s %-9s %-9s %-9s %-9s %s" % (
        "TICK", "8-Ks", "2.01acq", "5.01ctl", "1.01agr", "10-12B", "span"))
    tot = {"n": 0, "acq_disp": 0, "control": 0, "spin": 0, "any_struct": 0}
    for (t, cik) in COS:
        try:
            d = fetch(cik)
        except Exception as e:
            print("%-6s fetch error %s" % (t, str(e)[:20])); continue
        rec = d.get("filings", {}).get("recent", {})
        forms = rec.get("form", [])
        items = rec.get("items", [])
        dates = rec.get("filingDate", [])
        n8k = acq = ctl = agr = spin = 0
        d8k = []
        for i, f in enumerate(forms):
            it = items[i] if i < len(items) else ""
            if f == "8-K":
                n8k += 1
                d8k.append(dates[i])
                if "2.01" in it:
                    acq += 1
                if "5.01" in it:
                    ctl += 1
                if "1.01" in it:
                    agr += 1
            if f in ("10-12B", "10-12B/A"):
                spin += 1
        span = "%s..%s" % (d8k[-1][:7], d8k[0][:7]) if d8k else "-"
        struct = acq + ctl + spin
        tot["n"] += 1
        tot["acq_disp"] += acq
        tot["control"] += ctl
        tot["spin"] += spin
        tot["any_struct"] += 1 if struct > 0 else 0
        print("%-6s %-7d %-9d %-9d %-9d %-9d %s" % (t, n8k, acq, ctl, agr, spin, span))
        time.sleep(0.15)
    print("\n=== frequency across %d companies ===" % tot["n"])
    print("  companies with >=1 acq/disposition (2.01) or control (5.01) or spin: %d/%d" % (
        tot["any_struct"], tot["n"]))
    print("  total acq/disp (2.01): %d   control (5.01): %d   spinoff regs (10-12B): %d" % (
        tot["acq_disp"], tot["control"], tot["spin"]))
    print("\n  NOTE: submissions 'recent' covers ~last 1000 filings (recent years), not full history.")


if __name__ == "__main__":
    main()
