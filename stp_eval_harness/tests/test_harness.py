"""Unit tests: every expected value below is computed by hand from the
manuscript's definitions, not copied from the implementation's output."""

from __future__ import annotations

import json
import random
import tempfile
import unittest
from pathlib import Path

from stp_eval import budget, context, metrics, profile, records, report, segment, segmentation_metrics, stats


class ProfileTests(unittest.TestCase):
    def test_velocity_and_positive_acceleration(self):
        emb = [[1, 0], [1, 0], [0, 1]]
        v = profile.velocity(emb)
        self.assertEqual(v, [None, 0.0, 1.0])
        self.assertEqual(profile.positive_acceleration(v), [None, 0.0, 1.0])

    def test_acceleration_is_clamped_after_a_peak(self):
        v = [None, 1.0, 0.0]
        self.assertEqual(profile.positive_acceleration(v), [None, 0.0, 0.0])

    def test_volatility_population_sd_truncated_window(self):
        v = [None, 0.0, 1.0]
        sig = profile.volatility(v, w=2)
        self.assertEqual(sig[1], 0.0)
        self.assertAlmostEqual(sig[2], 0.5)

    def test_robust_scaler_fallback_chain(self):
        s = profile.RobustScaler().fit([1, 2, 3, 4, 5])
        self.assertEqual((s.method, s.center, s.scale), ("iqr", 3, 2))
        s = profile.RobustScaler().fit([0, 0, 0, 0, 1])  # IQR = MAD = 0, SD = 0.4
        self.assertEqual(s.method, "sd")
        self.assertAlmostEqual(s.scale, 0.4)
        self.assertEqual(profile.RobustScaler().fit([0, 0, 0]).method, "unit")

    def test_boundary_probability_is_logistic(self):
        p = profile.compute_profile([[1, 0], [0, 1]], None, w=3)
        p.v_hat, p.a_hat, p.sigma_hat = [None, 2.0], [None, 0.0], [None, 0.0]
        pi = profile.boundary_probabilities(p, profile.BoundaryWeights(w_v=1.0, beta=-2.0))
        self.assertAlmostEqual(pi[1], 0.5)


class SegmentTests(unittest.TestCase):
    def test_threshold_cut(self):
        pi = [None] + [0.1] * 9
        pi[5] = 0.9
        chunks = segment.segment([10] * 10, pi, segment.SegmentParams(0.5, 20, 40, 60))
        self.assertEqual([(c.start, c.end) for c in chunks], [(0, 4), (5, 9)])

    def test_forced_cut_prefers_target_length(self):
        # Eq. 7 by hand, L_t=30: overflow at unit 4 scores cuts 2,3,4 as -0.067, 0.1, -0.067,
        # so the cut is 3; the same trace from s=3 gives a cut at 6.
        chunks = segment.segment([10] * 10, [None] + [0.1] * 9, segment.SegmentParams(0.5, 20, 30, 40, gamma=0.5))
        self.assertEqual([(c.start, c.end) for c in chunks], [(0, 2), (3, 5), (6, 9)])

    def test_oversize_unit_is_isolated_and_flagged(self):
        chunks = segment.segment([10, 100, 10], [None, 0.0, 0.0], segment.SegmentParams(0.5, 5, 20, 50))
        self.assertEqual([(c.start, c.end, c.oversize) for c in chunks], [(0, 0, False), (1, 1, True), (2, 2, False)])

    def test_chunks_partition_units(self):
        rng = random.Random(7)
        for _ in range(200):
            n = rng.randint(1, 40)
            toks = [rng.randint(1, 60) for _ in range(n)]
            pi = [None] + [rng.random() for _ in range(n - 1)]
            chunks = segment.segment(toks, pi, segment.SegmentParams(0.6, 30, 80, 120))
            covered = [u for c in chunks for u in range(c.start, c.end + 1)]
            self.assertEqual(covered, list(range(n)))
            for c in chunks:
                if c.start != c.end:
                    self.assertLessEqual(c.tokens, 120)

    def test_fixed_size(self):
        chunks = segment.fixed_size([10] * 5, 25)
        self.assertEqual([(c.start, c.end) for c in chunks], [(0, 1), (2, 3), (4, 4)])


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.emb = [[1.0, 0.0]] * 6
        self.texts = ["alpha"] * 6
        self.sections = ["s1"] * 6
        self.tokens = [10] * 6
        self.pi = [None, 0.0, 0.0, 0.0, 0.95, 0.0]
        self.chunk = segment.Chunk(2, 3, 20)

    def test_horizons_follow_boundary_strength(self):
        p = context.ContextParams(H_max=6)
        self.assertEqual(context.horizons(self.chunk, self.pi, 6, p), (6, 1))
        p.profile_guided = False
        self.assertEqual(context.horizons(self.chunk, self.pi, 6, p), (6, 6))

    def test_barrier_excludes_candidate_across_strong_transition(self):
        scores = {c.unit: c.score for c in context.score_candidates(
            self.chunk, self.emb, self.texts, self.sections, self.pi, context.ContextParams())}
        self.assertAlmostEqual(scores[1], 1 + 0.25 - 0.25 / 6)
        self.assertAlmostEqual(scores[0], 1 + 0.25 - 0.25 * 2 / 6)
        self.assertAlmostEqual(scores[4], 1 + 0.25 - 0.95 - 0.25 / 6)
        chosen = context.select_context(self.chunk, self.emb, self.texts, self.tokens, self.sections, self.pi,
                                        context.ContextParams(B_ctx=100))
        self.assertEqual(chosen, [0, 1])

    def test_budget_limits_selection(self):
        chosen = context.select_context(self.chunk, self.emb, self.texts, self.tokens, self.sections, self.pi,
                                        context.ContextParams(B_ctx=15))
        self.assertEqual(chosen, [1])


class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.ranked = [budget.RankedChunk("A", [100, 100]), budget.RankedChunk("B", [50], [30]),
                       budget.RankedChunk("C", [40, 40])]

    def test_pack_stops_when_no_unit_fits(self):
        packed = budget.pack(self.ranked, 300)
        self.assertEqual([p.chunk_id for p in packed], ["A", "B"])
        self.assertEqual(budget.prompt_tokens(packed), 280)

    def test_pack_truncates_at_unit_boundary_and_drops_context(self):
        packed = budget.pack(self.ranked, 260)
        self.assertEqual([(p.chunk_id, p.tokens_used, p.truncated) for p in packed], [("A", 200, False), ("B", 50, True)])


class MetricTests(unittest.TestCase):
    def test_credit_threshold(self):
        self.assertTrue(metrics.credits((0, 10), (5, 15)))
        self.assertFalse(metrics.credits((0, 9), (5, 15)))

    def test_recall_and_mrr(self):
        ranked, gold = [(100, 200), (0, 10)], [(5, 15), (300, 310)]
        self.assertEqual(metrics.recall_at_k(ranked, gold, 1), 0.0)
        self.assertEqual(metrics.recall_at_k(ranked, gold, 2), 0.5)
        self.assertEqual(metrics.mrr_at_k(ranked, gold), 0.5)

    def test_evidence_split_and_context_precision(self):
        self.assertEqual(metrics.evidence_split_rate([(0, 10), (10, 20)], [(5, 15), (0, 5)]), 0.5)
        self.assertEqual(metrics.context_precision([(0, 10)], [(5, 20)]), 0.5)
        self.assertIsNone(metrics.context_precision([], [(0, 1)]))
        self.assertEqual(metrics.context_recovery([(100, 110)], [(0, 10)], [(0, 10), (100, 110)]), 1.0)

    def test_squad_em_f1(self):
        self.assertEqual(metrics.exact_match("The Eiffel Tower", ["eiffel tower"]), 1.0)
        self.assertAlmostEqual(metrics.token_f1("eiffel tower paris", ["eiffel tower"]), 0.8)
        self.assertEqual(metrics.token_f1("london", ["eiffel tower"]), 0.0)


class SegmentationMetricTests(unittest.TestCase):
    def test_pk_and_windowdiff(self):
        self.assertEqual(segmentation_metrics.pk([5], [5], 10), 0.0)
        self.assertAlmostEqual(segmentation_metrics.pk([5], [], 10), 0.25)
        self.assertAlmostEqual(segmentation_metrics.window_diff([5], [], 10), 0.25)

    def test_boundary_prf(self):
        self.assertEqual(segmentation_metrics.boundary_prf([5, 10], [6, 20]), {"precision": 0.5, "recall": 0.5, "f1": 0.5})


class StatsTests(unittest.TestCase):
    def test_constant_differences_give_degenerate_interval(self):
        ci = stats.paired_bootstrap([0.1] * 20, resamples=500)
        self.assertAlmostEqual(ci.low, 0.1)
        self.assertAlmostEqual(ci.high, 0.1)

    def test_cluster_bootstrap_counts_clusters(self):
        ci = stats.cluster_bootstrap([1, 1, -1, -1], ["x", "x", "y", "y"], resamples=500)
        self.assertEqual((ci.mean, ci.n_units), (0.0, 2))
        self.assertLess(ci.low, 0)
        self.assertGreater(ci.high, 0)

    def test_sign_flip(self):
        self.assertEqual(stats.sign_flip_test([0.0] * 10, permutations=200), 1.0)
        self.assertLess(stats.sign_flip_test([1.0] * 12, permutations=2000), 0.01)

    def test_holm(self):
        adj = stats.holm({"a": 0.01, "b": 0.04, "c": 0.03})
        self.assertAlmostEqual(adj["a"], 0.03)
        self.assertAlmostEqual(adj["c"], 0.06)
        self.assertAlmostEqual(adj["b"], 0.06)


def _record(arm: str, qid: str, doc: str, f1: float) -> records.QueryRecord:
    return records.QueryRecord(
        dataset="T", arm=arm, query_id=qid, doc_id=doc, question="q?", gold_answers=["a"],
        gold_spans=[(0, 5)], retrieved=[records.RetrievedChunk("c1", 0.9, 120, (0, 50))],
        prompt="p", prompt_tokens=120, raw_generation="a", prediction="a",
        metrics={"f1": f1, "em": float(f1 == 1.0)})


class RecordAndReportTests(unittest.TestCase):
    def test_roundtrip_gzip_and_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "arm.jsonl.gz"
            records.write_records(path, [_record("x", "q1", "d1", 0.5)])
            back = list(records.read_records(path))
            self.assertEqual(back[0].retrieved[0].span, (0, 50))
            records.write_manifest([path], Path(d) / "m.json")
            self.assertEqual(records.verify_manifest(Path(d) / "m.json"), [])

    def test_report_pairs_only_shared_queries(self):
        with tempfile.TemporaryDirectory() as d:
            ds = Path(d) / "T"
            records.write_records(ds / "base.jsonl", [_record("base", f"q{i}", f"d{i % 3}", 0.0) for i in range(9)])
            records.write_records(ds / "stp.jsonl", [_record("stp", f"q{i}", f"d{i % 3}", 1.0) for i in range(6)])
            bundle = report.build_bundle(Path(d), "base", ["f1"], {"T"}, resamples=300)
            row = bundle["datasets"]["T"]["comparisons"]["f1"]["stp"]
            self.assertEqual((row["n_pairs"], row["n_units"], row["delta"]), (6, 3, 1.0))
            json.dumps(bundle)  # must be serialisable


if __name__ == "__main__":
    unittest.main()
