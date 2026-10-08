"""
evidence.py — evidence-availability types for the Thing 2 Financial Phase Map.

Two layers, per the frozen plan (LIMEN-session-checkpoint 2026-10-07, §15):

INPUT layer — every numeric input arrives wrapped in an Availability:
    MEASURED        a real observation (nonzero)
    MEASURED_ZERO   a real 0.0 observation — NEVER equal to missing
    MISSING         no observation for that quarter/input
    STALE           observation older than the freshness bound
    UNSUPPORTED     the input is not producible for this company/domain

VERDICT layer — phases the map does not emit carry an explicit UNKNOWN code:
    UNKNOWN_ABSTAINED             detector exists, withheld by decision 9.14(c)
                                  (P3, distress modes, P7 fork)
    UNKNOWN_NOT_BUILT             no detector in this release
                                  (P1, P6, P8, P9, P10)
    UNKNOWN_INSUFFICIENT_HISTORY  evidence below the measurement floor
                                  (< 8 elapsed quarters, or < 12 measured for
                                  rhythm/flatness, or interior gaps in a window
                                  under the zero-tolerated-gaps default)

The three codes have different repair paths: a decision, a build, or time.
"""

MEASURED = "MEASURED"
MEASURED_ZERO = "MEASURED_ZERO"
MISSING = "MISSING"
STALE = "STALE"
UNSUPPORTED = "UNSUPPORTED"

UNKNOWN_ABSTAINED = "UNKNOWN_ABSTAINED"
UNKNOWN_NOT_BUILT = "UNKNOWN_NOT_BUILT"
UNKNOWN_INSUFFICIENT_HISTORY = "UNKNOWN_INSUFFICIENT_HISTORY"

UNKNOWN_REASONS = (UNKNOWN_ABSTAINED, UNKNOWN_NOT_BUILT, UNKNOWN_INSUFFICIENT_HISTORY)


class Availability(object):
    """Immutable wrapper: how one input value was obtained."""

    __slots__ = ("kind", "value", "note")

    def __init__(self, kind, value=None, note=""):
        if kind not in (MEASURED, MEASURED_ZERO, MISSING, STALE, UNSUPPORTED):
            raise ValueError("unknown availability kind: %r" % (kind,))
        if kind in (MEASURED, MEASURED_ZERO) and value is None:
            raise ValueError("%s requires a numeric value" % kind)
        self.kind = kind
        self.value = value
        self.note = note

    @property
    def is_measured(self):
        return self.kind in (MEASURED, MEASURED_ZERO)

    def __repr__(self):
        return "Availability(%s, value=%r, note=%r)" % (self.kind, self.value, self.note)

    def __eq__(self, other):
        return (
            isinstance(other, Availability)
            and (self.kind, self.value, self.note) == (other.kind, other.value, other.note)
        )

    def __ne__(self, other):
        return not self.__eq__(other)


class PhaseVerdict(object):
    """The map's output. NEVER carries validation — Thing 2 is interpretive only."""

    __slots__ = ("phase", "mode", "status", "reason", "formula_version", "evidence")

    def __init__(self, phase, mode, status, reason, formula_version, evidence):
        self.phase = phase          # 'p0' | 'p2' | 'p4' | 'p5' | None
        self.mode = mode            # Was mode string | None
        self.status = status        # phase string, or one of the UNKNOWN_REASONS
        self.reason = reason        # human-readable, cites the governing rule
        self.formula_version = formula_version
        self.evidence = evidence    # dict: per-input availability + rule intermediates

    @property
    def is_unknown(self):
        return self.status in UNKNOWN_REASONS

    @property
    def interpretive_only(self):
        return True

    def to_dict(self):
        return {
            "phase": self.phase,
            "mode": self.mode,
            "status": self.status,
            "reason": self.reason,
            "formula_version": self.formula_version,
            "interpretive_only": True,
            "validated": False,
            "evidence": self.evidence,
        }

    def __repr__(self):
        return "PhaseVerdict(status=%r, mode=%r, reason=%r)" % (
            self.status, self.mode, self.reason)


def measured(value, note=""):
    """Wrap a real observation; 0.0 becomes MEASURED_ZERO automatically."""
    if value is None:
        raise ValueError("measured() requires a value; use missing() instead")
    v = float(value)
    if v == 0.0:
        return Availability(MEASURED_ZERO, v, note)
    return Availability(MEASURED, v, note)


def missing(note=""):
    return Availability(MISSING, None, note)


def stale(value, note=""):
    return Availability(STALE, float(value), note)


def unsupported(note=""):
    return Availability(UNSUPPORTED, None, note)
