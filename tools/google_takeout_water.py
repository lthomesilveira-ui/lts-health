"""Build a private review from original Google Health Takeout hydration CSVs.

No network or database writes. Archive bytes and generated rows must remain private.
Only one positive, typed MyFitnessPal daily log at local midnight is eligible.
Zero/unspecified units, other sources and ambiguous days are never promoted.
"""
import argparse
import csv
import hashlib
import io
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from zipfile import ZipFile
from zoneinfo import ZoneInfo

MEMBER = re.compile(r"^Takeout/Google Health/Physical Activity_GoogleData/Hydration Log/hydration_log_\d{4}-\d{2}-\d{2}\.csv$")
HEADERS = ["start time", "end time", "amount consumed", "data source"]
MFP = "MyFitnessPal Fitbit 3P Web API"
LOCAL = ZoneInfo("America/Sao_Paulo")


def build_review(archive):
    archive = Path(archive)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    positives = defaultdict(list)
    exclusions = Counter()
    row_count = 0
    with ZipFile(archive) as z:
        names = [n for n in z.namelist() if MEMBER.fullmatch(n)]
        if not names or len(names) != len(set(names)):
            raise ValueError("missing_or_duplicate_hydration_members")
        for name in sorted(names):
            member = z.getinfo(name)
            if member.file_size > 20_000_000:
                raise ValueError("hydration_member_too_large")
            rows = csv.DictReader(io.StringIO(z.read(name).decode("utf-8-sig")))
            if rows.fieldnames != HEADERS:
                raise ValueError("unexpected_hydration_schema")
            for line, row in enumerate(rows, 2):
                row_count += 1
                if set(row) != set(HEADERS) or any(v is None for v in row.values()):
                    raise ValueError("malformed_hydration_row")
                match = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?) MILLILITER", row["amount consumed"])
                if not match:
                    exclusions["untyped_amount"] += 1
                    continue
                amount = Decimal(match[1])
                if not 0 < amount <= 100000 or amount != amount.to_integral_value():
                    exclusions["invalid_amount"] += 1
                    continue
                try:
                    start = datetime.fromisoformat(row["start time"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(row["end time"].replace("Z", "+00:00"))
                    if start.tzinfo is None or end.tzinfo is None:
                        raise ValueError("timezone_required")
                    local = start.astimezone(LOCAL)
                except ValueError as exc:
                    raise ValueError("invalid_hydration_interval") from exc
                positives[local.date().isoformat()].append((row, name, line, start, end, int(amount), local))

    def evidence_record(observation, date, scope):
        row, member, line, start, end, amount, local = observation
        identity = json.dumps([row[k] for k in HEADERS], separators=(",", ":"), ensure_ascii=False)
        record_hash = hashlib.sha256(identity.encode()).hexdigest()
        daily = scope != "event"
        canonical = scope == "canonical"
        namespace = {"canonical": "water", "source": "water-source", "event": "water-event"}[scope]
        return {
            "source_record_id": f"google_health_takeout:{namespace}:{record_hash}",
            "metric_date": date,
            "metric_type": {"canonical": "dietary_water_ml", "source": "dietary_water_source_total_ml",
                            "event": "dietary_water_source_event_ml"}[scope],
            "value": amount, "unit": "mL",
            "source_name": "MyFitnessPal · Google Health" if daily else "Google Health App",
            "source_family": "google_health_takeout", "canonical_status": "canonical" if canonical else "held",
            "confidence": "authenticated_google_takeout", "source_file": archive.name,
            "source_payload": {
                "entry_method": "google_health_takeout_water_v1" if canonical else "google_health_takeout_water_review_v1",
                "export_version": 1, "archive_sha256": digest, "archive_member": member, "csv_line": line,
                "original_start": row["start time"], "original_end": row["end time"],
                "original_amount": row["amount consumed"], "original_unit": "MILLILITER",
                "original_source": row["data source"], "aggregation": "day" if daily else "event",
                "local_date": date, "timezone": "America/Sao_Paulo",
                "scope": {"canonical": "one_unambiguous_positive_daily_source_log",
                          "source": "single_daily_total_for_named_source", "event": "individual_named_source_event"}[scope],
            },
        }

    records = []
    source_review = []
    for date, observations in sorted(positives.items()):
        producer_rows = [item for item in observations if item[0]["data source"] == MFP]
        if len(producer_rows) == 1:
            item = producer_rows[0]
            if item[6].time() == datetime.min.time() and item[4] - item[3] == timedelta(minutes=1):
                source_review.append(evidence_record(item, date, "source"))
        for item in observations:
            if item[0]["data source"] == "Google Health App" and item[4] - item[3] == timedelta(seconds=1):
                source_review.append(evidence_record(item, date, "event"))
        if len(observations) != 1:
            exclusions["ambiguous_day"] += len(observations)
            continue
        row, member, line, start, end, amount, local = observations[0]
        if row["data source"] != MFP:
            exclusions["unverified_source"] += 1
            continue
        if (local.hour, local.minute, local.second, local.microsecond) != (0, 0, 0, 0) or end - start != timedelta(minutes=1):
            exclusions["unverified_daily_interval"] += 1
            continue
        records.append(evidence_record(observations[0], date, "canonical"))
    return {"archive_sha256": digest, "hydration_rows": row_count,
            "eligible_days": len(records), "excluded": dict(exclusions), "records": records,
            "source_review": source_review}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive")
    args = parser.parse_args()
    print(json.dumps(build_review(args.archive), ensure_ascii=False, indent=2))
