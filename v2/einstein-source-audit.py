#!/usr/bin/env python3
"""Read-only audit of the supplied Einstein laboratory text layout.

Only headed laboratory pages are read. Clinical summaries are not substituted
for laboratory reports. Output is private; this tool has no database or network.
"""
import argparse
from datetime import date
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata


def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value))
                   if not unicodedata.combining(c)).casefold()


def key(value):
    return re.sub(r'\s+', ' ', fold(value)).strip()


def iso_date(raw):
    m = re.fullmatch(r'(\d{2})/(\d{2})/(\d{4})', raw)
    if not m:
        return None
    try:
        return date(int(m[3]), int(m[2]), int(m[1])).isoformat()
    except ValueError:
        return None


def numeric(raw):
    if not re.fullmatch(r'[+-]?\d+(?:,\d+)?', str(raw).strip()):
        return None
    try:
        return str(Decimal(str(raw).strip().replace(',', '.')))
    except InvalidOperation:
        return None


UNIT_ALIASES = {'uU/ml': 'uU/mL', 'ug/dL': 'µg/dL', 'µL': '/uL', 'μL': '/uL', 'uL': '/uL'}
MEASURE = re.compile(r'^((?:[<>]=?\s*)?[+-]?\d+(?:,\d+)?)\s*'
                     r'(x10\^6/uL|x10\^3/uL|µUI/mL|μUI/mL|µg/dL|μg/dL|'
                     r'ug/dL|uU/ml|uU/mL|mUI/mL|ng/mL|mg/dL|g/dL|U/L|fL|pg|%|/mL|µL|μL)$')
SIMPLE = {'CREATININA,': 'Creatinina', 'UREIA,': 'Ureia',
          'TSH - HORMONIO': 'TSH', 'TGO-AST': 'TGO (AST)',
          'TGP-ALT': 'TGP (ALT)', 'GAMA GT': 'Gama GT',
          'FOSFATASE ALCALINA,': 'Fosfatase Alcalina',
          'FERRITINA,': 'Ferritina', 'GLICOSE,': 'Glicose',
          'HEMOGLOBINA GLICADA,': 'Hemoglobina Glicada (A1C)'}
QUALITATIVE = {'SOROLOGIA PARA HCV,': 'Sorologia HCV',
               'HEPATITE B - ANTI HBC TOTAL,': 'Hepatite B - Anti-HBc Total',
               'SOROLOGIA PARA HIV 1 E 2,': 'Sorologia HIV 1 e 2',
               'HEPATITE B - HBSAG,': 'Hepatite B - HBsAg'}


def cells(line):
    return [s.strip() for s in re.split(r'\s{2,}', line.strip()) if s.strip()]


def patient_identity(page):
    header = page[:1400]
    birth = re.search(r'Data de Nascimento:\s*(\d{2}/\d{2}/\d{4})', header)
    if not birth or not iso_date(birth[1]):
        return None
    explicit = re.search(r'^[ \t]*Exmo\(a\)Sr\(a\):[ \t]*([^\n]+)', header, re.M)
    same_line = re.search(r'^[ \t]*(\S[^\n]+?)[ \t]{2,}Data de Nascimento:', header, re.M)
    preceding_record = re.search(r'^[ \t]*([^\n]+)\n[ \t]*Prontuário:', header, re.M)
    name = explicit[1] if explicit else same_line[1] if same_line else preceding_record[1] if preceding_record else None
    if not name or key(name).startswith(('prontuario:', 'cpf:', 'albert einstein', 'data de nascimento:')):
        return None
    return key(name) + '|' + birth[1]


def blocks(text):
    output, patients = [], set()
    for page_no, page in enumerate(text.split('\f'), 1):
        if not re.search(r'ALBERT EINSTEIN MEDICINA DIAGNÓSTICA', page[:250]):
            continue
        patient_key = patient_identity(page)
        if not patient_key:
            continue
        patients.add(patient_key)
        collected = re.search(r'Coletado em:\s*(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2}:\d{2})', page)
        if not collected:
            # A continuation must be the immediately following headed page of
            # the same patient's lipid panel. No arbitrary nearby date is used.
            previous = output[-1] if output else None
            if previous and previous['last_page'] == page_no - 1 and previous['patient_key'] == patient_key and previous['heading'].startswith('colesterol total e fracoes') and re.search(r'^TRIGLIC[ÉE]RIDES:', page, re.M):
                body = page.split('Responsável técnico:', 1)[0]
                previous['body'] += '\n' + body
                previous['continuation_page'] = page_no
                previous['last_page'] = page_no
                assay = re.search(r'Número do Laboratório:\s*([A-Z0-9-]+)', page, re.I)
                if assay and not previous['source_assay_key']:
                    previous['source_assay_key'] = assay[1]
            continue
        day = iso_date(collected[1])
        if not day:
            continue
        pre = page[:collected.start()].splitlines()
        # Only the assay heading immediately before the explicit collection
        # label is authoritative. A patient's name is never an assay heading.
        headings = [s.strip() for s in pre if s.strip()]
        heading = key(headings[-1]) if headings else ''
        assay = re.search(r'Número do Laboratório:\s*([A-Z0-9-]+)', page, re.I)
        released = re.search(r'Liberado em:\s*(\d{2}/\d{2}/\d{4})', page)
        body = page[collected.end():]
        body = body.split('Médico Solicitante:', 1)[-1].split('\n', 1)[-1]
        body = body.split('Responsável técnico:', 1)[0]
        output.append({'heading': heading, 'body': body, 'pdf_page': page_no,
                       'last_page': page_no, 'collection_date': day,
                       'collection_local_time': collected[2],
                       'release_date': iso_date(released[1]) if released else None,
                       'source_assay_key': assay[1] if assay else None,
                       'patient_key': patient_key})
    return output, len(patients) == 1 and bool(output)


def parse_layout(text):
    rows, unsupported = [], []
    source_blocks, patient_consistent = blocks(text)

    def emit(block, marker, raw, unit=None, reference=None, page=None, basis='printed_result'):
        rows.append({'biomarker': marker, 'collection_date': block['collection_date'],
                     'release_date': block['release_date'],
                     'collection_local_time': block['collection_local_time'],
                     'source_assay_key': block['source_assay_key'],
                     'patient_identity_sha256': hashlib.sha256(block['patient_key'].encode()).hexdigest(),
                     'pdf_page': page or block['pdf_page'],
                     'collection_date_page': block['pdf_page'],
                     'result_raw': raw, 'result_numeric': numeric(raw),
                     'unit': UNIT_ALIASES.get(unit, unit), 'source_unit_raw': unit,
                     'reference_raw': reference, 'unit_basis': basis})

    def measured(block, marker, value, reference=None, page=None):
        match = MEASURE.fullmatch(value.strip())
        if match:
            emit(block, marker, match[1], match[2], reference, page)
            return True
        return False

    def labeled(block, marker, label, unit=None, dimensionless=False):
        for line in block['body'].splitlines():
            if ':' not in line or key(line.split(':', 1)[0]) != key(label):
                continue
            values = cells(line.split(':', 1)[1])
            if not values:
                continue
            ref = values[1] if len(values) > 1 else None
            if dimensionless and re.fullmatch(r'[+-]?\d+(?:,\d+)?', values[0]):
                emit(block, marker, values[0], unit, ref, basis='explicit_dimensionless_label')
            elif unit is None:
                emit(block, marker, values[0], None, ref)
            else:
                measured(block, marker, values[0], ref)

    for block in source_blocks:
        heading, body = block['heading'], block['body']
        before = len(rows)
        for prefix, marker in SIMPLE.items():
            if heading.startswith(key(prefix)):
                primary = re.split(r'Método\s*:|Método Glicose:', body, maxsplit=1)[0]
                for line in primary.splitlines():
                    values = cells(line)
                    if values and measured(block, marker, values[0], values[1] if len(values) > 1 else None):
                        break
        if heading.startswith('hemograma com plaquetas'):
            names = {'hemacias': 'Hemácias', 'hemoglobina': 'Hemoglobina', 'hematocrito': 'Hematócrito',
                     'vcm': 'VCM', 'hcm': 'HCM', 'chcm': 'CHCM', 'rdw': 'RDW',
                     'leucocitos': 'Leucócitos', 'plaquetas': 'Plaquetas',
                     'volume medio plaquetario': 'Volume Médio Plaquetário'}
            differentials = ['Neutrófilos', 'Eosinófilos', 'Basófilos', 'Linfócitos', 'Monócitos']
            for line in body.splitlines():
                if ':' not in line:
                    continue
                label, tail = line.split(':', 1)
                values = cells(tail)
                if key(label) in names and values:
                    measured(block, names[key(label)], values[0], values[-1] if len(values) > 1 else None)
                for name in differentials:
                    if key(label) == key(name) and len(values) >= 2:
                        measured(block, name + ' (%)', values[0])
                        measured(block, name + ' (absoluto)', values[1], values[2] if len(values) > 2 else None)
        if heading.startswith('indice de saturacao do ferro'):
            labeled(block, 'Saturação da Transferrina', 'Índice de Saturação da Transferrina', '%')
            labeled(block, 'Ferro Sérico', 'Ferro Sérico', 'µg/dL')
            labeled(block, 'TIBC - Capacidade de Fixação de Ferro', 'TIBC - Capacidade de Fixação de Ferro', 'µg/dL')
        if heading.startswith('hemoglobina glicada'):
            labeled(block, 'Glicemia Média Estimada', 'Glicemia média estimada', 'mg/dL')
        for prefix, marker in QUALITATIVE.items():
            if heading.startswith(key(prefix)):
                labeled(block, marker, 'Resultado')
        if heading.startswith('hepatite b - anti hbs,'):
            labeled(block, 'Hepatite B - Anti-HBs', 'Resultado', 'mUI/mL')
        if heading.startswith('hepatite a - anti hav igg,'):
            labeled(block, 'Hepatite A - Anti-HAV IgG', 'Índice HAV', 'índice', True)
        if heading.startswith('urina tipo i,'):
            fields = ['Densidade', 'Cor', 'Aspecto', 'pH', 'Proteína', 'Açúcar', 'Corpos cetônicos',
                      'Pigmentos biliares', 'Urobilinogênio', 'Nitrito', 'Esterase', 'Hemoglobina',
                      'Hemácias', 'Leucócitos', 'Cilindros hialinos', 'Cilindros granulosos', 'Leveduras', 'Cristais']
            for field in fields:
                if field in ['Densidade', 'pH']:
                    labeled(block, 'Urina - ' + field, field, '', True)
                elif field in ['Hemácias', 'Leucócitos']:
                    labeled(block, 'Urina - ' + field, field, '/mL')
                else:
                    labeled(block, 'Urina - ' + field, field)
        if heading.startswith('colesterol total e fracoes'):
            lipids = {'COLESTEROL TOTAL': 'Colesterol Total', 'HDL COLESTEROL': 'HDL-Colesterol',
                      'LDL COLESTEROL': 'LDL-Colesterol', 'COLESTEROL NÃO-HDL': 'Colesterol Não-HDL',
                      'TRIGLICÉRIDES': 'Triglicérides'}
            for line in body.splitlines():
                if ':' not in line:
                    continue
                label, tail = line.split(':', 1)
                for source_label, marker in lipids.items():
                    if key(label) == key(source_label):
                        values = cells(tail)
                        if values:
                            measured(block, marker, values[0], page=block.get('continuation_page') if marker == 'Triglicérides' else None)
        if len(rows) == before:
            unsupported.append({'pdf_page': block['pdf_page'], 'heading': heading, 'reason': 'unsupported_layout'})
    # The separately formatted mycology report explicitly labels preliminary
    # and final states. Preserve a preliminary result as held; never turn it
    # into a final negative or choose solely by a later date.
    held_preliminary = []
    for page_no, page in enumerate(text.split('\f'), 1):
        if 'ALBERT EINSTEIN MEDICINA DIAGNÓSTICA' not in page[:250] or 'Exmo(a)Sr(a):' not in page:
            continue
        for section in re.split(r'(?=^[ \t]*Exame:)', page, flags=re.M)[1:]:
            marker = ('Pesquisa de Fungos - Unha' if re.match(r'\s*Exame:\s*Pesquisa de Fungos em', section)
                      else 'Cultura para Fungos - Unha' if re.match(r'\s*Exame:\s*Cultura para Fungos em', section) else None)
            if not marker or not re.search(r'Tipo de amostra:\s*Unha\b', section):
                continue
            patient = patient_identity(page)
            assay = re.search(r'Número do laboratório:\s*([A-Z0-9-]+)', section, re.I)
            if not patient or not assay:
                unsupported.append({'pdf_page': page_no, 'reason': 'missing_assay_or_patient_identity'})
                continue
            if 'Laudo preliminar' in section or 'Laudo Parcial' in section:
                held_preliminary.append({'pdf_page': page_no, 'biomarker': marker, 'reason': 'explicit_preliminary_report'})
                continue
            if 'Relatório final' not in section:
                continue
            collected = re.search(r'Data/hora da coleta:\s*(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2})\s+BRT', section)
            released = re.search(r'Data/hora/equipe verificada:\s*(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2})\s+BRT[^\n]*\n', section)
            result_match = re.search(r'Data/hora/equipe verificada:[^\n]*\n([^\n]+)\n[ \t]*Dados Interpretativos', section)
            if not collected or not released or not result_match or not iso_date(collected[1]) or not iso_date(released[1]):
                continue
            raw = result_match[1].strip()
            if not raw or len(raw) > 300:
                continue
            rows.append({'biomarker': marker, 'collection_date': iso_date(collected[1]),
                         'collection_local_time': collected[2], 'reported_timezone': 'BRT',
                         'source_assay_key': assay[1],
                         'patient_identity_sha256': hashlib.sha256(patient.encode()).hexdigest(),
                         'release_date': iso_date(released[1]), 'release_local_time': released[2],
                         'pdf_page': page_no, 'collection_date_page': page_no,
                         'result_raw': raw, 'result_numeric': None, 'unit': None,
                         'source_unit_raw': None, 'reference_raw': None,
                         'unit_basis': 'qualitative', 'report_status': 'explicit_final'})
    unique = {}
    for row in rows:
        # Equal values on one day are not duplicate proof. The printed assay,
        # patient and collection clock must also agree before copies collapse.
        signature = (row['biomarker'], row['collection_date'], row['collection_local_time'],
                     row['source_assay_key'], row['patient_identity_sha256'],
                     row['result_raw'], row['unit'], row['release_date'])
        if not row['source_assay_key']:
            signature += (row['pdf_page'],)
        if signature not in unique:
            unique[signature] = {**row, 'source_pages': [row['pdf_page']]}
        elif row['pdf_page'] not in unique[signature]['source_pages']:
            unique[signature]['source_pages'].append(row['pdf_page'])
    return {'rows': list(unique.values()), 'unsupported_blocks': unsupported,
            'held_preliminary': held_preliminary, 'patient_headers_consistent': patient_consistent}


def compare_expected(parsed, expected):
    findings = []
    for row in expected:
        candidates = [r for r in parsed['rows'] if r['biomarker'] == row['biomarker'] and r['collection_date'] == row['collection_date']]
        issues = []
        if len(candidates) != 1:
            issues.append('missing_or_ambiguous_source_result')
        else:
            source = candidates[0]
            if not source.get('source_assay_key') or not parsed['patient_headers_consistent']:
                issues.append('source_identity_not_verified')
            a, b = source['result_numeric'], row.get('result_numeric')
            if (a is None) != (b is None) or (a is not None and Decimal(a) != Decimal(str(b))):
                issues.append('numeric_result_mismatch')
            if a is None and key(source['result_raw']) != key(row.get('result_raw')):
                issues.append('qualifier_or_qualitative_mismatch')
            if source['unit'] != row.get('unit'):
                issues.append('unit_mismatch')
            if row.get('report_date') != source['release_date']:
                issues.append('release_date_mismatch')
        findings.append({'source_record_id': row['source_record_id'], 'biomarker': row['biomarker'],
                         'collection_date': row['collection_date'], 'pdf_page': candidates[0]['pdf_page'] if len(candidates) == 1 else None,
                         'status': 'verified' if not issues else 'review_required',
                         'value_unit_collection_status': 'verified' if not [issue for issue in issues if issue != 'release_date_mismatch'] else 'review_required',
                         'issues': issues})
    return findings


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--pdf', required=True)
    cli.add_argument('--expected')
    cli.add_argument('--output', required=True)
    args = cli.parse_args()
    target = Path(args.output).resolve()
    if target.is_relative_to(Path(__file__).resolve().parents[1]):
        raise ValueError('private_audit_output_must_be_outside_a_repository')
    pdf = Path(args.pdf)
    extracted = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], check=True, capture_output=True).stdout.decode('utf8')
    parsed = parse_layout(extracted)
    expected = json.loads(Path(args.expected).read_text()) if args.expected else []
    findings = compare_expected(parsed, expected)
    document = {'schema': 'einstein_offline_source_audit_v1', 'read_only': True, 'production_import_enabled': False,
                'source_sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
                'page_count': len(extracted.rstrip('\f\n').split('\f')), **parsed, 'findings': findings}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    target.chmod(0o600)
    print('Einstein source audit: review required' if any(r['issues'] for r in findings) else 'Einstein source audit: completed')
    return int(any(r['issues'] for r in findings) or not parsed['patient_headers_consistent'])


if __name__ == '__main__':
    raise SystemExit(main())
