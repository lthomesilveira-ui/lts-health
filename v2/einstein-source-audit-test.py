#!/usr/bin/env python3
"""Invented reports exercise source safety; no personal fixture is embedded."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('einstein-source-audit.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def page(body='1,25 mg/dL     0,50 - 1,00', heading='CREATININA, SORO',
         patient='Pessoa Inventada', assay='TEST-A', collected='02/01/2020 08:00:00', released='03/01/2020'):
    return f'''ALBERT EINSTEIN MEDICINA DIAGNÓSTICA
{patient}     Data de Nascimento: 01/01/1990
Prontuário: INVENTADO
{heading}
Coletado em: {collected}     Liberado em: {released} 11:00:00
Médico Solicitante:
{body}
Método: Inventado
Número do Laboratório: {assay}
Responsável técnico: Fixture
Data da impressão: 30/12/2026
'''


def mycology(status='Relatório final', value='Negativo', assay='TEST-M'):
    return f'''ALBERT EINSTEIN MEDICINA DIAGNÓSTICA
Exmo(a)Sr(a): Pessoa Inventada
Prontuário: INVENTADO     Data de Nascimento: 01/01/1990
Exame: Cultura para Fungos em     Número do laboratório: {assay}
Tipo de amostra: Unha     Data/hora da coleta: 02/01/2020 08:30 BRT
{status}
Data/hora/equipe verificada: 12/01/2020 10:00 BRT Fixture
{value}
Dados Interpretativos
'''


class SourceSafety(unittest.TestCase):
    def test_numeric_qualifiers_do_not_become_exact(self):
        for raw in ['<1,25', '>1,25', '1.25', '1,25 texto', '1,2,5']:
            self.assertIsNone(audit.numeric(raw))
        self.assertEqual(audit.numeric('-1,25'), '-1.25')
        parsed = audit.parse_layout(page('<1,25 mg/dL     0,50 - 1,00'))
        self.assertEqual(parsed['rows'][0]['result_raw'], '<1,25')
        self.assertIsNone(parsed['rows'][0]['result_numeric'])

    def test_primary_result_not_reference_or_print_date(self):
        row = audit.parse_layout(page())['rows'][0]
        self.assertEqual(row['result_numeric'], '1.25')
        self.assertEqual(row['reference_raw'], '0,50 - 1,00')
        self.assertEqual(row['collection_date'], '2020-01-02')
        self.assertEqual(row['release_date'], '2020-01-03')

    def test_same_value_requires_assay_patient_and_clock(self):
        self.assertEqual(len(audit.parse_layout(page()+'\f'+page())['rows']), 1)
        for other in [page(assay='TEST-B'), page(collected='02/01/2020 09:00:00'), page(patient='Outra Pessoa')]:
            self.assertEqual(len(audit.parse_layout(page()+'\f'+other)['rows']), 2)
        self.assertFalse(audit.parse_layout(page()+'\f'+page(patient='Outra Pessoa'))['patient_headers_consistent'])

    def test_unknown_heading_and_narrative_do_not_supply_result(self):
        parsed = audit.parse_layout(page(heading='NOTA CLÍNICA, NÃO É EXAME'))
        self.assertEqual(parsed['rows'], [])
        self.assertEqual(len(parsed['unsupported_blocks']), 1)
        self.assertEqual(audit.parse_layout(page().replace('ALBERT EINSTEIN MEDICINA DIAGNÓSTICA', 'Resumo'))['rows'], [])

    def test_absolute_and_percentage_are_separate(self):
        rows = audit.parse_layout(page('Neutrófilos:     42,5 %     2100 µL     1700 - 8000', heading='HEMOGRAMA COM PLAQUETAS, SANGUE TOTAL'))['rows']
        self.assertEqual([(r['biomarker'], r['result_numeric'], r['unit']) for r in rows], [('Neutrófilos (%)', '42.5', '%'), ('Neutrófilos (absoluto)', '2100', '/uL')])

    def test_preliminary_cannot_override_explicit_final(self):
        parsed = audit.parse_layout(mycology('Laudo preliminar', 'Parcialmente negativo')+'\f'+mycology())
        self.assertEqual(len(parsed['held_preliminary']), 1)
        self.assertEqual(len(parsed['rows']), 1)
        self.assertEqual(parsed['rows'][0]['result_raw'], 'Negativo')
        self.assertEqual(parsed['rows'][0]['release_date'], '2020-01-12')

    def test_date_discrepancy_stays_visible_without_rewriting(self):
        parsed = audit.parse_layout(page())
        expected = {'source_record_id': 'fixture', 'biomarker': 'Creatinina', 'collection_date': '2020-01-02', 'report_date': '2020-01-02', 'result_raw': '1,25', 'result_numeric': 1.25, 'unit': 'mg/dL'}
        finding = audit.compare_expected(parsed, [expected])[0]
        self.assertEqual(finding['issues'], ['release_date_mismatch'])
        self.assertEqual(finding['value_unit_collection_status'], 'verified')
        self.assertEqual(expected['report_date'], '2020-01-02')

    def test_continuation_requires_immediate_same_patient(self):
        first = page('COLESTEROL TOTAL:  170 mg/dL', heading='COLESTEROL TOTAL E FRAÇÕES, SORO')
        continuation = '''ALBERT EINSTEIN MEDICINA DIAGNÓSTICA
Pessoa Inventada     Data de Nascimento: 01/01/1990
Prontuário: INVENTADO
TRIGLICÉRIDES:  82 mg/dL
Responsável técnico: Fixture
'''
        rows = audit.parse_layout(first+'\f'+continuation)['rows']
        self.assertEqual(rows[-1]['biomarker'], 'Triglicérides')
        self.assertEqual(rows[-1]['pdf_page'], 2)
        for changed in [continuation.replace('Pessoa Inventada', 'Outra Pessoa'), '\f'+continuation]:
            self.assertEqual(len(audit.parse_layout(first+'\f'+changed)['rows']), 1)


if __name__ == '__main__':
    unittest.main()
