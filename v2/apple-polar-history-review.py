"""Prepare original Polar observations for review, never canonical workouts.

Only history strictly earlier than the existing AccessLink calendar window is
eligible. Overlap and ambiguous identities stay held; matching values or dates
never create a link. This offline utility has no database or network client.
"""
import argparse
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from pathlib import Path
from xml.etree.ElementTree import iterparse
import zipfile


ACTIVITIES = {
    "HKWorkoutActivityTypeOther": "Outro exercício",
    "HKWorkoutActivityTypeTraditionalStrengthTraining": "Treinamento de força",
    "HKWorkoutActivityTypeWalking": "Caminhada",
}


def instant(raw):
    result = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("missing_timezone")
    return result


def observation(event, archive_digest, xml_member):
    attrs = event["attributes"]
    if attrs.get("sourceName") != "Polar Flow":
        raise ValueError("unsupported_source")
    metadata = defaultdict(set)
    for entry in event["metadata"]:
        metadata[entry.get("key")].add(entry.get("value"))
    sync_ids = metadata["HKMetadataKeySyncIdentifier"]
    if len(sync_ids) != 1 or not next(iter(sync_ids)):
        raise ValueError("ambiguous_sync_identity")
    sync_id = next(iter(sync_ids))
    exercise_ids = metadata["ExerciseIdentifier"]
    if exercise_ids and exercise_ids != sync_ids:
        raise ValueError("conflicting_exercise_identity")
    start, end = instant(attrs["startDate"]), instant(attrs["endDate"])
    if end < start:
        raise ValueError("reversed_interval")
    if attrs.get("durationUnit") != "min":
        raise ValueError("unsupported_duration_unit")
    try:
        duration = Decimal(attrs["duration"])
    except (InvalidOperation, KeyError):
        raise ValueError("invalid_duration") from None
    if not duration.is_finite() or duration < 0 or duration * 60 > Decimal(str((end - start).total_seconds())) + 1:
        raise ValueError("invalid_duration")
    if attrs.get("workoutActivityType") not in ACTIVITIES:
        raise ValueError("unsupported_activity_type")
    identity = json.dumps([attrs["sourceName"], sync_id], ensure_ascii=False, separators=(",", ":"))
    return {
        "source_record_id": "polar_apple_xml_v1:" + hashlib.sha256(identity.encode()).hexdigest(),
        "workout_date": start.date().isoformat(),
        "recorded_start": attrs["startDate"],
        "session_name": ACTIVITIES[attrs["workoutActivityType"]],
        "duration_minutes": str(duration),
        "heart_rate_avg": None,
        "heart_rate_max": None,
        "source_name": "Polar Flow · original Apple Saúde",
        "source_payload": {
            "schema": "polar_apple_xml_v1",
            "archive_sha256": archive_digest,
            "xml_member": xml_member,
            "source_sync_identifier": sync_id,
            "original_attributes": attrs,
            "original_metadata": event["metadata"],
            "original_statistics": event["statistics"],
            "canonical_link_status": "unverified",
            "eligibility_rule": "strictly_before_existing_accesslink_calendar_window",
        },
    }


def review(events, archive_digest, xml_member, existing):
    provider = [row for row in existing if row.get("source_payload", {}).get("schema") == "polar_accesslink_v4"]
    if not provider:
        raise ValueError("existing_provider_history_required")
    cutoff = min(date.fromisoformat(row["workout_date"]) for row in provider)
    accepted, held, grouped = [], [], defaultdict(list)
    for index, event in enumerate(events):
        try:
            row = observation(event, archive_digest, xml_member)
            grouped[row["source_record_id"]].append((index, row))
        except (ValueError, KeyError, TypeError) as error:
            held.append({"event_index": index, "reason": str(error)})
    starts = defaultdict(set)
    for key, group in grouped.items():
        for _, row in group:
            starts[instant(row["recorded_start"])].add(key)
    for key, group in grouped.items():
        row = group[0][1]
        variants = {json.dumps(item, sort_keys=True, ensure_ascii=False) for _, item in group}
        reason = "conflicting_sync_identity" if len(variants) != 1 else \
            "conflicting_start_identity" if len(starts[instant(row["recorded_start"])]) != 1 else \
            "overlaps_existing_provider_window" if date.fromisoformat(row["workout_date"]) >= cutoff else None
        if reason:
            held.extend({"event_index": index, "reason": reason} for index, _ in group)
        else:
            accepted.append(row)
    return {"format": "lts-polar-original-history-review-v1", "archive_sha256": archive_digest,
            "provider_cutoff": cutoff.isoformat(), "canonical_linking_performed": False,
            "candidates": sorted(accepted, key=lambda row: row["recorded_start"]), "held": held}


def extract(path):
    with open(path, "rb") as original:
        digest = hashlib.file_digest(original, "sha256").hexdigest()
    events = []
    with zipfile.ZipFile(path) as archive:
        paths = [name for name in archive.namelist() if name.endswith(("/export.xml", "/exportar.xml"))]
        if len(paths) != 1:
            raise ValueError("expected_one_original_xml")
        with archive.open(paths[0]) as source:
            context = iterparse(source, events=("start", "end"))
            _, root = next(context)
            for event, element in context:
                if event != "end":
                    continue
                if element.tag == "Workout" and element.get("sourceName") == "Polar Flow":
                    events.append({"attributes": dict(element.attrib),
                                   "metadata": [dict(c.attrib) for c in element if c.tag == "MetadataEntry"],
                                   "statistics": [dict(c.attrib) for c in element if c.tag == "WorkoutStatistics"]})
                if element.tag in ("Record", "Workout", "ActivitySummary"):
                    element.clear()
                    root.clear()
    return events, digest, paths[0]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--existing", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if Path(__file__).resolve().parent.parent in args.output.resolve().parents:
        raise ValueError("private_output_must_be_outside_checkout")
    events, digest, member = extract(args.archive)
    result = review(events, digest, member, json.loads(args.existing.read_text()))
    descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(result, output, ensure_ascii=False)
    print("Original history review prepared privately; canonical linking remains unverified.")
