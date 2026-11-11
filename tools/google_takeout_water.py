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

    records = []
    for date, observations in sorted(positives.items()):
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
        # Stable across export archive names and CSV ordering; never use a mutable line as identity.
        identity = json.dumps([row[k] for k in HEADERS], separators=(",", ":"), ensure_ascii=False)
        record_hash = hashlib.sha256(identity.encode()).hexdigest()
        records.append({
            "source_record_id": "google_health_takeout:water:" + record_hash,
            "metric_date": date, "metric_type": "dietary_water_ml", "value": amount, "unit": "mL",
            "source_name": "MyFitnessPal · Google Health", "source_family": "google_health_takeout",
            "canonical_status": "canonical", "confidence": "authenticated_google_takeout",
            "source_file": archive.name,
            "source_payload": {
                "entry_method": "google_health_takeout_water_v1", "export_version": 1,
                "archive_sha256": digest, "archive_member": member, "csv_line": line,
                "original_start": row["start time"], "original_end": row["end time"],
                "original_amount": row["amount consumed"], "original_unit": "MILLILITER",
                "original_source": row["data source"], "aggregation": "day",
                "local_date": date, "timezone": "America/Sao_Paulo",
                "scope": "one_unambiguous_positive_daily_source_log",
            },
        })
    return {"archive_sha256": digest, "hydration_rows": row_count,
            "eligible_days": len(records), "excluded": dict(exclusions), "records": records}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive")
    args = parser.parse_args()
    print(json.dumps(build_review(args.archive), ensure_ascii=False, indent=2))
