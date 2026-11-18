import csv
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location("takeout_water", Path(__file__).parents[1] / "google_takeout_water.py")
water = importlib.util.module_from_spec(spec)
spec.loader.exec_module(water)
MEMBER = "Takeout/Google Health/Physical Activity_GoogleData/Hydration Log/hydration_log_2030-02-01.csv"


class TakeoutWaterTests(unittest.TestCase):
    def archive(self, rows, name="original.zip", headers=None):
        path = Path(self.directory.name) / name
        content = io.StringIO()
        writer = csv.writer(content)
        writer.writerow(headers or water.HEADERS)
        writer.writerows(rows)
        with ZipFile(path, "w") as z:
            z.writestr(MEMBER, content.getvalue())
            # An unrelated credential file must never be parsed or extracted.
            z.writestr("Takeout/Google Health/User Security Data/User_Retired_Password.csv", b"\xff")
        return path

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.row = ["2030-02-11T03:00:00Z", "2030-02-11T03:01:00Z", "1234.0 MILLILITER", water.MFP]

    def test_provenance_local_date_and_stable_identity(self):
        first = water.build_review(self.archive([self.row]))
        row = first["records"][0]
        self.assertEqual((row["metric_date"], row["value"], row["unit"]), ("2030-02-11", 1234, "mL"))
        self.assertEqual(row["source_payload"]["csv_line"], 2)
        self.assertEqual(row["source_payload"]["archive_sha256"], first["archive_sha256"])
        self.assertEqual(row["source_payload"]["original_source"], water.MFP)
        zero = ["2030-02-12T15:00:00Z", "2030-02-12T15:01:00Z", "0.0 VOLUME_UNIT_UNSPECIFIED", "MyFitnessPal Google Web API"]
        later = water.build_review(self.archive([zero, self.row], "later.zip"))
        self.assertEqual(later["records"][0]["source_record_id"], row["source_record_id"])
        self.assertEqual(later["records"][0]["source_payload"]["csv_line"], 3)
        self.assertEqual(later["excluded"], {"untyped_amount": 1})

    def test_invalid_or_untyped_amounts_never_become_zero_or_totals(self):
        for amount in ["0.0 MILLILITER", "0.0 VOLUME_UNIT_UNSPECIFIED", "NaN MILLILITER", "1 LITER", "100001 MILLILITER", "1.5 MILLILITER", "-1 MILLILITER"]:
            with self.subTest(amount=amount):
                row = self.row.copy(); row[2] = amount
                self.assertEqual(water.build_review(self.archive([row]))["records"], [])

    def test_multiple_logs_or_unverified_sources_and_intervals_are_held(self):
        cases = [[self.row, self.row]]
        for index, value in [(3, "Google Health App"), (0, "2030-02-11T04:00:00Z"), (1, "2030-02-11T03:02:00Z")]:
            row = self.row.copy(); row[index] = value; cases.append([row])
        for rows in cases:
            self.assertEqual(water.build_review(self.archive(rows))["records"], [])

    def test_unknown_schema_and_missing_hydration_fail(self):
        with self.assertRaisesRegex(ValueError, "unexpected_hydration_schema"):
            water.build_review(self.archive([self.row], headers=["a", "b", "c", "d"]))
        path = Path(self.directory.name) / "empty.zip"
        with ZipFile(path, "w") as z:
            z.writestr("unrelated.csv", "a,b")
        with self.assertRaisesRegex(ValueError, "missing_or_duplicate"):
            water.build_review(path)

    def test_source_specific_total_and_event_do_not_promote_a_mixed_day(self):
        event = ["2030-02-11T17:00:10Z", "2030-02-11T17:00:11Z", "130.0 MILLILITER", "Google Health App"]
        result = water.build_review(self.archive([self.row, event]))
        self.assertEqual(result["records"], [])
        daily, single = result["source_review"]
        self.assertEqual([daily["canonical_status"], single["canonical_status"]], ["held", "held"])
        self.assertEqual((daily["value"], daily["metric_type"]), (1234, "dietary_water_source_total_ml"))
        self.assertEqual((single["value"], single["source_payload"]["aggregation"]), (130, "event"))
        self.assertNotEqual(daily["source_record_id"], single["source_record_id"])
        reordered = water.build_review(self.archive([event, self.row], "new.zip"))
        self.assertEqual([r["source_record_id"] for r in reordered["source_review"]],
                         [daily["source_record_id"], single["source_record_id"]])
        repeated = water.build_review(self.archive([self.row, self.row, event]))
        self.assertEqual([row["metric_type"] for row in repeated["source_review"]], ["dietary_water_source_event_ml"])
        zero = self.row.copy()
        zero[2] = "0.0 VOLUME_UNIT_UNSPECIFIED"
        self.assertEqual(water.build_review(self.archive([zero]))["source_review"], [])


if __name__ == "__main__":
    unittest.main()
