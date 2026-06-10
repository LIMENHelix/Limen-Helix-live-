#!/usr/bin/env python3
"""
RUN 30 NEW companies through the full event-walk and print each walk, so it can be
PROVEN against documented history (or marked UNPROVEN where unverifiable). The honest
scale test. None of these 30 were used in building/validating the engine.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'api', 'helix_app', 'thing1'))
import limen_backtest as lb           # noqa: E402
import integrated_walk as iw          # noqa: E402
import peer_walk as pw                # noqa: E402
import events as ev                   # noqa: E402

SECTORS = {
    "defense":  [("BA", "0000012927"), ("LMT", "0000936468"), ("GD", "0000040533"),
                 ("NOC", "0001133421"), ("RTX", "0000101829"), ("LHX", "0000202058")],
    "logistics": [("UPS", "0001090727"), ("FDX", "0001048911"), ("CHRW", "0001043277"),
                  ("EXPD", "0000746515")],
    "media":    [("DIS", "0001744489"), ("NFLX", "0001065280"), ("CMCSA", "0001166691"),
                 ("WBD", "0001437107"), ("PARA", "0000813828"), ("FOXA", "0001754301")],
    "restaurants": [("CMG", "0001058090"), ("SBUX", "0000829224"), ("YUM", "0001041061"),
                    ("MCD", "0000063908"), ("DPZ", "0001286681"), ("QSR", "0001618756")],
    "hotels":   [("MAR", "0001048286"), ("HLT", "0001585689"), ("H", "0001468174"),
                 ("WH", "0001722684"), ("HST", "0001070750")],
    "airlines": [("LUV", "0000092380"), ("UAL", "0000100517"), ("DAL", "0000027904"),
                 ("AAL", "0000006201"), ("ALK", "0000766421")],
    "consumer": [("LULU", "0001397187"), ("ULTA", "0001403568"), ("EL", "0001001250"),
                 ("NKE", "0000320187"), ("DECK", "0000910521")],
    "grocery":  [("KR", "0000056873"), ("DLTR", "0000935703"), ("DG", "0000029534"),
                 ("ACI", "0001646972"), ("SFM", "0001466146")],
    "oilsvc":   [("SLB", "0000087347"), ("HAL", "0000045012"), ("BKR", "0001701605"),
                 ("NOV", "0001021860")],
    "metals":   [("FCX", "0000831259"), ("NUE", "0000073309"), ("STLD", "0001022671"),
                 ("X", "0001163302"), ("CLF", "0000764065")],
    "internet": [("ZM", "0001585521"), ("SHOP", "0001594805"), ("PYPL", "0001633917"),
                 ("ROKU", "0001428439"), ("ETSY", "0001370637"), ("DOCU", "0001261333")],
}

TARGETS = [
    ("BA", "0000012927", "defense"), ("LMT", "0000936468", "defense"),
    ("GD", "0000040533", "defense"), ("NOC", "0001133421", "defense"),
    ("UPS", "0001090727", "logistics"), ("FDX", "0001048911", "logistics"),
    ("DIS", "0001744489", "media"), ("NFLX", "0001065280", "media"),
    ("CMCSA", "0001166691", "media"), ("CMG", "0001058090", "restaurants"),
    ("SBUX", "0000829224", "restaurants"), ("YUM", "0001041061", "restaurants"),
    ("MAR", "0001048286", "hotels"), ("HLT", "0001585689", "hotels"),
    ("LUV", "0000092380", "airlines"), ("UAL", "0000100517", "airlines"),
    ("EL", "0001001250", "consumer"), ("LULU", "0001397187", "consumer"),
    ("ULTA", "0001403568", "consumer"), ("KR", "0000056873", "grocery"),
    ("DLTR", "0000935703", "grocery"), ("SLB", "0000087347", "oilsvc"),
    ("HAL", "0000045012", "oilsvc"), ("FCX", "0000831259", "metals"),
    ("NUE", "0000073309", "metals"), ("ZM", "0001585521", "internet"),
    ("SHOP", "0001594805", "internet"), ("PYPL", "0001633917", "internet"),
    ("ROKU", "0001428439", "internet"), ("ETSY", "0001370637", "internet"),
]


def main():
    import time
    secmeds = {}
    for sec in set(s for _, _, s in TARGETS):
        secmeds[sec] = pw.sector_median_growth_from(SECTORS[sec])
    for (t, cik, sec) in TARGETS:
        try:
            facts = lb.fetch_sec_facts(cik)
            qs, rows = iw.build(facts)
            base = iw.persist([pw.arbitrate_rel(qs, rows, i, secmeds[sec]) for i in range(len(qs))])
            over = ev.overlay(qs, base, rows, ev.event_quarters(cik))
            eps = [e for e in iw.episodes(qs, over) if not (e[0] == e[1] and e[2] == "transition")]
        except Exception as e:
            print("\n%-6s [%s]  ERROR %s" % (t, sec, str(e)[:30])); continue
        print("\n%-6s [%s]" % (t, sec))
        for (s, e, p) in eps[-6:]:
            print("  %s-%s  %s" % (iw.fmt(s), iw.fmt(e), p) if s != e else "  %s        %s" % (iw.fmt(s), p))
        time.sleep(0.1)


if __name__ == "__main__":
    main()
