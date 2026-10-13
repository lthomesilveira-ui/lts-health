"""Synthetic failure cases for the offline source audit; contains no patient data."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("source_audit", Path(__file__).with_name("fleury-source-audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def block(title, content, day="03/02/2001"):
    return (title + "\nMétodo: Método sintético\nRESULTADO                       VALORES DE REFERÊNCIA\n"
            + content + "\nRECEBIDO/COLETADO EM: " + day + " - LIBERADO EM: " + day + "\n")


class SourceAuditTest(unittest.TestCase):
    def test_explicit_decimal_notation_and_qualifiers(self):
        self.assertEqual(audit.numeric("3,75"), "3.75")
        self.assertEqual(audit.numeric("7.25", "dot"), "7.25")
        self.assertEqual(audit.numeric("12.345", "grouped_count"), "12345")
        for raw in ["<7", "inferior a 7", "7 mg/dL", "3-7", "7e3", "7.5"]:
            self.assertIsNone(audit.numeric(raw))
        self.assertIsNone(audit.numeric("12.34", "grouped_count"))
        with self.assertRaises(ValueError):
            audit.numeric("7", "guessed")

    def test_reference_and_history_are_not_current_results(self):
        text = block("GLICOSE, soro", " 82 mg/dL                        60 a 105 mg/dL\n"
                     "RESULTADOS ANTERIORES:\n 77 mg/dL")
        text += "\fLAUDO EVOLUTIVO\nGLICOSE, soro\nRESULTADO\n 63 mg/dL\n"
        rows = audit.parse_layout(text)["rows"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["result_numeric"], "82")

    def test_different_assay_on_same_page_is_not_selected(self):
        text = block("GLICOSE, soro", " 82 mg/dL") + block("UREIA, soro", " 33 mg/dL")
        rows = audit.parse_layout(text)["rows"]
        self.assertEqual({r["biomarker"]: r["result_numeric"] for r in rows}, {"Glicose": "82", "Ureia": "33"})

    def test_invalid_collection_date_is_held(self):
        self.assertEqual(audit.parse_layout(block("GLICOSE, soro", " 82 mg/dL", "31/02/2001"))["rows"], [])

    def test_censored_value_remains_non_numeric(self):
        row = audit.parse_layout(block("HORMONIO LUTEINIZANTE, soro", " inferior a 0,7 UI/L"))["rows"][0]
        self.assertEqual(row["result_raw"], "inferior a 0,7")
        self.assertIsNone(row["result_numeric"])

    def test_psa_does_not_extract_detection_limits_or_notes(self):
        text = block("ANTIGENO PROSTATICO ESPECIFICO(PSA), soro",
                     " PSA Total: 1,21 ng/mL\n PSA Livre: 0,31 ng/mL\n"
                     " Relacao PSA livre/PSA total: 0,26\n"
                     " Ensaio limite PSA total = 0,009 ng/mL\nNOTA 1:\n PSA Total: 9,87 ng/mL")
        rows = audit.parse_layout(text)["rows"]
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["result_numeric"], "1.21")

    def test_named_result_does_not_guess_another_unit(self):
        text = block("ANTIGENO PROSTATICO ESPECIFICO(PSA), soro", " PSA Total: 1,21 microg/L")
        self.assertEqual(audit.parse_layout(text)["rows"], [])

    def test_percent_and_absolute_cell_counts_remain_separate(self):
        text = block("HEMOGRAMA, sangue total", " % /mm3\n LEUCÓCITOS  6.420\n Neutrófilos : 55,5  3.560   800 a 7000")
        values = {r["biomarker"]: (r["result_numeric"], r["unit"]) for r in audit.parse_layout(text)["rows"]}
        self.assertEqual(values["Leucócitos"], ("6420", "/mm3"))
        self.assertEqual(values["Neutrófilos"], ("3560", "/mm3"))
        self.assertEqual(values["Neutrófilos (%)"], ("55.5", "%"))

    def test_electrophoresis_uses_two_documented_decimal_styles(self):
        text = block("ELETROFORESE DAS PROTEÍNAS SÉRICAS", " g/dL     %\n ALBUMINA : 4,31  (61.2)   3,5 a 5,1 (40 a 70)")
        rows = audit.parse_layout(text)["rows"]
        self.assertEqual([r["result_numeric"] for r in rows], ["4.31", "61.2"])
        self.assertEqual([r["unit"] for r in rows], ["g/dL", "%"])

    def test_albumin_label_does_not_consume_ratio(self):
        text = block("PROTEINA TOTAL E FRACOES, soro", " ALBUMINA : 4,1 g/dL\n ALBUMINA/GLOBULINAS: 1,7")
        values = {r["biomarker"]: r["result_numeric"] for r in audit.parse_layout(text)["rows"]}
        self.assertEqual(values, {"Albumina": "4.1", "Relação Albumina/Globulina": "1.7"})

    def test_qualitative_index_is_not_a_numeric_result(self):
        text = block("ANTICORPOS ANTI-VIRUS DA HEPATITE C, soro", " NÃO REAGENTE (NEGATIVO)             Não reagente\n Índice: 0,17")
        row = audit.parse_layout(text)["rows"][0]
        self.assertIsNone(row["result_numeric"])
        self.assertIn("0,17", row["result_raw"])

    def test_snapshot_requires_hash_page_date_value_unit(self):
        parsed = audit.parse_layout(block("GLICOSE, soro", " 82 mg/dL"))
        expected = {"biomarker": "Glicose", "collection_date": "2001-02-03", "pdf_page": "1",
                    "sha256": "synthetic_hash", "result_raw": "82", "result_numeric": "82",
                    "numeric_kind": "exact", "unit": "mg/dL"}
        self.assertEqual(audit.compare_expected(parsed, [expected], "synthetic_hash")[0]["status"], "verified")
        for key, value in [("sha256", "other"), ("pdf_page", "2"), ("collection_date", "2001-02-04"),
                           ("result_numeric", "83"), ("result_raw", "84"), ("unit", "mg/L")]:
            self.assertEqual(audit.compare_expected(parsed, [{**expected, key: value}], "synthetic_hash")[0]["status"], "review_required")
        self.assertFalse(audit.same_unit("mg/dL", "mg/L"))
        self.assertFalse(audit.same_unit("mU/L", "MU/L"))

    def test_equal_copies_allowed_but_conflicting_copies_are_held(self):
        parsed = audit.parse_layout(block("GLICOSE, soro", " 82 mg/dL") + block("GLICOSE, soro", " 82 mg/dL"))
        expected = {"biomarker": "Glicose", "collection_date": "2001-02-03", "pdf_page": "1",
                    "sha256": "synthetic", "result_raw": "82", "result_numeric": "82", "unit": "mg/dL"}
        self.assertEqual(audit.compare_expected(parsed, [expected], "synthetic")[0]["status"], "verified")
        parsed["rows"][-1]["result_numeric"] = "83"
        self.assertIn("missing_or_ambiguous_source_result", audit.compare_expected(parsed, [expected], "synthetic")[0]["issues"])

    def test_print_date_not_a_collection_date(self):
        parsed = audit.parse_layout(block("GLICOSE, soro", " 82 mg/dL") + "Impresso em: 04/02/2001")
        self.assertEqual(parsed["rows"][0]["collection_date"], "2001-02-03")
        self.assertEqual(parsed["document_print_dates"], ["2001-02-04"])

    def test_no_private_output_in_source_checkout(self):
        with self.assertRaises(ValueError):
            audit.private_output(Path(__file__).parent / "private-rows.json")


if __name__ == "__main__":
    unittest.main()
