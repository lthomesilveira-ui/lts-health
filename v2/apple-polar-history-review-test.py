"""Invented source cases; no patient fixtures or database writes."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("history", Path(__file__).with_name("apple-polar-history-review.py"))
history = importlib.util.module_from_spec(spec)
spec.loader.exec_module(history)


def event(start="2020-02-01 10:00:00 +0000", sync="example-id"):
    return {"attributes": {"sourceName": "Polar Flow", "startDate": start,
            "endDate": start.replace("10:00:00", "11:00:00"), "duration": "59.5", "durationUnit": "min",
            "workoutActivityType": "HKWorkoutActivityTypeTraditionalStrengthTraining"},
            "metadata": [{"key": "HKMetadataKeySyncIdentifier", "value": sync}], "statistics": []}


class HistoryReview(unittest.TestCase):
    def run_review(self, events, existing=None, digest="a" * 64):
        return history.review(events, digest, "apple_health_export/exportar.xml", existing if existing is not None else [
            {"workout_date": "2020-03-01", "source_payload": {"schema": "polar_accesslink_v4"}}])

    def test_original_before_window_stays_separate(self):
        result = self.run_review([event()])
        self.assertEqual(len(result["candidates"]), 1)
        row = result["candidates"][0]
        self.assertEqual(row["duration_minutes"], "59.5")
        self.assertIsNone(row["heart_rate_avg"])
        self.assertEqual(row["source_payload"]["canonical_link_status"], "unverified")
        self.assertFalse(result["canonical_linking_performed"])
        self.assertNotIn("calories_kcal", row)

    def test_same_calendar_day_and_later_remain_held(self):
        result = self.run_review([event("2020-03-01 10:00:00 +0000", "one"), event("2020-03-02 10:00:00 +0000", "two")])
        self.assertEqual(result["candidates"], [])
        self.assertEqual([row["reason"] for row in result["held"]], ["overlaps_existing_provider_window"] * 2)

    def test_stable_sync_identity_across_archives(self):
        first = self.run_review([event()])["candidates"][0]
        second = self.run_review([event()], digest="b" * 64)["candidates"][0]
        self.assertEqual(first["source_record_id"], second["source_record_id"])

    def test_identical_copies_collapse_conflicts_hold_all(self):
        self.assertEqual(len(self.run_review([event(), event()])["candidates"]), 1)
        changed = event(); changed["attributes"]["duration"] = "58"
        result = self.run_review([event(), changed])
        self.assertEqual(result["candidates"], [])
        self.assertEqual(len(result["held"]), 2)

    def test_different_sync_ids_at_same_instant_are_ambiguous(self):
        result = self.run_review([event(), event(sync="different")])
        self.assertEqual(result["candidates"], [])
        self.assertEqual({row["reason"] for row in result["held"]}, {"conflicting_start_identity"})

    def test_missing_conflicting_and_disagreeing_identity(self):
        for metadata in [[], [{"key": "HKMetadataKeySyncIdentifier", "value": "a"}, {"key": "HKMetadataKeySyncIdentifier", "value": "b"}],
                         [{"key": "HKMetadataKeySyncIdentifier", "value": "a"}, {"key": "ExerciseIdentifier", "value": "b"}]]:
            with self.subTest(metadata=metadata):
                row = event(); row["metadata"] = metadata
                self.assertEqual(self.run_review([row])["candidates"], [])

    def test_invalid_units_duration_interval_source_type_and_timezone(self):
        changes = [("durationUnit", "s"), ("duration", "NaN"), ("duration", "-1"), ("duration", "61"),
                   ("startDate", "2020-02-01 10:00:00"), ("endDate", "2020-02-01 09:00:00 +0000"),
                   ("sourceName", "Unidentified"), ("workoutActivityType", "Unknown")]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                row = event(); row["attributes"][key] = value
                result = self.run_review([row])
                self.assertEqual(result["candidates"], [])
                self.assertEqual(len(result["held"]), 1)

    def test_requires_independent_provider_boundary(self):
        with self.assertRaisesRegex(ValueError, "existing_provider_history_required"):
            self.run_review([event()], [])

    def test_previously_imported_rows_do_not_move_provider_boundary(self):
        existing = [{"workout_date": "2020-03-01", "source_payload": {"schema": "polar_accesslink_v4"}},
                    {"workout_date": "2020-01-01", "source_payload": {"schema": "polar_apple_xml_v1"}}]
        self.assertEqual(len(self.run_review([event()], existing)["candidates"]), 1)


if __name__ == "__main__":
    unittest.main()
