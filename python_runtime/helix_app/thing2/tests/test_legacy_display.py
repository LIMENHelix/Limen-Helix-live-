"""
test_legacy_display.py — live-surface display policy for the legacy engine.

Operator directive 2026-10-10 (THING2_REPLACEMENT_PLAN.md): legacy distress
phases (P3, P7 family, P9) read UNKNOWN on live surfaces per 9.14(c); all
remaining legacy output is labeled legacy — unvalidated. Display-only:
no engine math is tested here, only the re-shaping of the section dict.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from legacy_display import (  # noqa: E402
    SUPPRESSED_DISTRESS_PHASES,
    apply_legacy_display_policy,
)


def _section(dominant="p5", scores=None):
    return {
        "available": True,
        "kernel_id": "phase_engine.py",
        "kernel_runtime": "python-vercel",
        "kernel_version": "4.0.2-python",
        "validation_status": "experimental",
        "interpretive_only": True,
        "phase_state_label": "p5 endurance state",
        "dominant_phase": dominant,
        "phase_scores": scores if scores is not None else {
            "p0": 0.1, "p3": 0.9, "p5": 0.8, "p7a": 0.4, "p9": 0.3,
        },
        "narrative_safe": ["existing line"],
        "unsupported_reasons": [],
    }


class TestSuppression(unittest.TestCase):
    def test_all_distress_phases_suppressed(self):
        for ph in SUPPRESSED_DISTRESS_PHASES:
            s = apply_legacy_display_policy(_section(dominant=ph))
            self.assertIsNone(s["dominant_phase"], ph)
            self.assertIsNone(s["phase_state_label"], ph)
            self.assertEqual(s["suppressed_phases"], [ph], ph)
            self.assertTrue(any(ph in r for r in s["unsupported_reasons"]), ph)

    def test_non_distress_phase_survives(self):
        s = apply_legacy_display_policy(_section(dominant="p5"))
        self.assertEqual(s["dominant_phase"], "p5")
        self.assertNotIn("suppressed_phases", s)

    def test_suppressed_scores_zeroed_everywhere(self):
        s = _section(dominant="p5",
                     scores={"p3": 0.9, "p7": 0.8, "p7a": 0.7, "p7b": 0.6,
                             "p9": 0.5, "p5": 0.8})
        s["intrinsic_phase_scores"] = dict(s["phase_scores"])
        s["coupled_phase_scores"] = dict(s["phase_scores"])
        apply_legacy_display_policy(s)
        for key in ("phase_scores", "intrinsic_phase_scores", "coupled_phase_scores"):
            for ph in SUPPRESSED_DISTRESS_PHASES:
                self.assertEqual(s[key][ph], 0.0, (key, ph))
        self.assertEqual(s["phase_scores"]["p5"], 0.8)

    def test_legacy_label_applied(self):
        s = apply_legacy_display_policy(_section())
        self.assertEqual(s["kernel_lineage"], "legacy")
        self.assertTrue(s["legacy_unvalidated"])
        self.assertTrue(any("Legacy engine v4.0.2" in n for n in s["narrative_safe"]))

    def test_no_duplicate_narrative_on_reapply(self):
        s = apply_legacy_display_policy(_section())
        n = len(s["narrative_safe"])
        apply_legacy_display_policy(s)
        self.assertEqual(len(s["narrative_safe"]), n)

    def test_unavailable_section_also_labeled(self):
        s = apply_legacy_display_policy({
            "available": False, "dominant_phase": None,
            "phase_scores": {}, "narrative_safe": [], "unsupported_reasons": [],
        })
        self.assertEqual(s["kernel_lineage"], "legacy")
        self.assertIsNone(s["dominant_phase"])


if __name__ == "__main__":
    unittest.main()
