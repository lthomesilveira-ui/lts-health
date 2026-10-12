"""Profile source/date metadata from an original Apple Health ZIP, without values.

The result establishes source availability, not canonical workout linkage. The
stream never prints routes, device identifiers, measurements or personal notes.
"""
import argparse
import json
import re
import zipfile
from xml.etree.ElementTree import iterparse


def profile(path, workouts=None):
    summaries = {}
    strict_matches = []
    legacy = json.load(open(workouts, encoding='utf-8'))['workouts'] if workouts else []
    with zipfile.ZipFile(path) as archive:
        candidates = [name for name in archive.namelist()
                      if name.endswith(('/export.xml', '/exportar.xml'))]
        if len(candidates) != 1:
            raise ValueError('Expected one original Apple Health XML')
        with archive.open(candidates[0]) as source:
            context = iterparse(source, events=('start', 'end'))
            _, root = next(context)
            for event, element in context:
                if event != 'end':
                    continue
                if element.tag in ('Record', 'Workout'):
                    attrs = element.attrib
                    name = attrs.get('sourceName', '')
                    kind = attrs.get('type', element.tag)
                    relevant = ('polar' in name.lower() and element.tag == 'Workout') or kind.endswith('DietaryWater')
                    if relevant:
                        key = (name, kind)
                        row = summaries.setdefault(key, {'rows': 0, 'first_date': None,
                                                         'last_date': None, 'fields': set()})
                        day = attrs.get('startDate', '')[:10]
                        row['rows'] += 1
                        if day:
                            row['first_date'] = min(row['first_date'] or day, day)
                            row['last_date'] = max(row['last_date'] or day, day)
                        row['fields'].update(attrs.keys())
                        if element.tag == 'Workout':
                            row['fields'].update(child.tag for child in element)
                            duration = float(attrs.get('duration', 'nan'))
                            seconds = duration * {'s': 1, 'min': 60, 'hr': 3600}.get(attrs.get('durationUnit'), float('nan'))
                            heart = next((child.attrib for child in element
                                          if child.tag == 'WorkoutStatistics' and child.get('type') == 'HKQuantityTypeIdentifierHeartRate'), {})
                            candidates = []
                            for workout in legacy:
                                match = re.fullmatch(r'(\d{1,2}):(\d{2}):(\d{2})', str(workout.get('dur', '')))
                                if not match or workout.get('date_iso') != day:
                                    continue
                                expected = sum(int(v) * n for v, n in zip(match.groups(), (3600, 60, 1)))
                                try:
                                    same = abs(expected - seconds) < 0.01 and workout.get('fcMedia') == round(float(heart['average'])) and workout.get('fcMax') == round(float(heart['maximum']))
                                except (KeyError, ValueError):
                                    same = False
                                if same:
                                    candidates.append(workout['id'])
                            if len(candidates) == 1:
                                strict_matches.append(candidates[0])
                    element.clear()
                    root.clear()
    return {'source_metadata': [{'source': name, 'kind': kind, **row, 'fields': sorted(row['fields'])}
                               for (name, kind), row in sorted(summaries.items())],
            'exact_second_duration_and_rounded_hr_matches': len(strict_matches),
            'unique_legacy_matches': len(set(strict_matches)),
            'legacy_with_second_precision': sum(bool(re.fullmatch(r'(\d{1,2}):(\d{2}):(\d{2})', str(w.get('dur', '')))) for w in legacy)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--workouts')
    args = parser.parse_args()
    print(json.dumps({'canonical_mapping_verified': False, **profile(args.archive, args.workouts)}, ensure_ascii=False))
