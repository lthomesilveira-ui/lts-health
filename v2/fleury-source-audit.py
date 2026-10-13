#!/usr/bin/env python3
"""Read-only audit of known Fleury text layouts against a private lab snapshot.

Uses Poppler's layout-preserving extraction. This is an offline validation tool,
not a production importer. Unsupported assays, ambiguity and conflicting copies
remain explicit. It has no database client and never writes canonical records.
"""
import argparse
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata


def fold(value):
    text = str(value).replace("\xad", "-")
    return "".join(c for c in unicodedata.normalize("NFKD", text)
                   if not unicodedata.combining(c)).casefold()


def compact(value):
    return re.sub(r"\s+", " ", fold(value)).strip()


def iso_date(raw):
    from datetime import date
    match = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", raw)
    if not match:
        return None
    try:
        return date(int(match[3]), int(match[2]), int(match[1])).isoformat()
    except ValueError:
        return None


def numeric(raw, style="comma"):
    # A decimal convention is mandatory. Do not remove qualifiers or units.
    patterns = {"comma": r"[+-]?\d+(?:,\d+)?", "dot": r"[+-]?\d+(?:\.\d+)?",
                "grouped_count": r"\d{1,3}(?:\.\d{3})+|\d+"}
    if style not in patterns:
        raise ValueError("unknown_decimal_style")
    text = str(raw).strip()
    if not re.fullmatch(patterns[style], text):
        return None
    normalized = text.replace(".", "") if style == "grouped_count" else text.replace(",", ".")
    try:
        return str(Decimal(normalized))
    except InvalidOperation:
        return None


def result(raw, unit, style="comma", unit_basis="result"):
    return {"result_raw": raw, "result_numeric": numeric(raw, style), "unit": unit,
            "decimal_style": style, "unit_basis": unit_basis}


# Format vocabulary, never patient values. New layouts must be validated before
# adding them. Simple assays are anchored to their own receipt-delimited block.
SIMPLE = {
    "TGO (AST)": "TRANSAMINASE GLUTAMICO-OXALACETICA",
    "TGP (ALT)": "TRANSAMINASE GLUTAMICO-PIRUVICA",
    "TSH": "HORMONIO TIROESTIMULANTE", "Ureia": "UREIA,",
    "Ferritina": "FERRITINA,", "25-OH Vitamina D Total": "25 HIDROXI-VITAMINA D",
    "Ácido fólico": "ACIDO FOLICO,", "T4 Livre": "TIROXINA (T4) LIVRE",
    "Vitamina B-12": "VITAMINA B-12,", "Cortisol": "CORTISOL,",
    "Ferro": "FERRO,", "Gama-GT": "GAMA GLUTAMIL",
    "Fosfatase Alcalina": "FOSFATASE ALCALINA", "Testosterona Total": "TESTOSTERONA,",
    "Testosterona livre": "TESTOSTERONA LIVRE,", "SHBG": "GLOBULINA LIGADORA DE HORMONIOS SEXUAIS(SHBG)",
    "LH": "HORMONIO LUTEINIZANTE", "FSH": "HORMONIO FOLICULO ESTIMULANTE",
    "Prolactina": "PROLACTINA", "Insulina": "INSULINA,", "Glicose": "GLICOSE,",
    "Zinco (ICP/MS)": "ZINCO,", "Magnésio": "MAGNESIO,", "Ácido Úrico": "ACIDO URICO,",
    "Fibrinogênio": "FIBRINOGENIO,", "Proteína C Reativa": "PROTEINA C-REATIVA,",
    "Homocisteína": "HOMOCISTEINA,", "Apolipoproteína A1": "APOLIPOPROTEINA A-1",
    "Apolipoproteína B": "APOLIPOPROTEINA B,", "LDL-Colesterol": "LDL-COLESTEROL",
    "Colesterol Total": "COLESTEROL TOTAL", "HDL-Colesterol": "HDL-COLESTEROL",
    "Triglicérides": "TRIGLICERIDES", "VLDL-Colesterol": "VLDL-COLESTEROL",
    "Colesterol não-HDL": "NAO-HDL-COLESTEROL", "Albumina": "ALBUMINA,",
    "Proteína Total": "PROTEINA TOTAL,", "Anti-tireoglobulina": "ANTICORPOS ANTITIROGLOBULINA",
    "Anti-TPO": "ANTICORPOS ANTI-PEROXIDASE TIROIDIANA", "IGF-1": "IGF-1, SOMATOMEDINA",
    "Frutosamina": "FRUTOSAMINA,", "Creatinoquinase (CK)": "CREATINOQUINASE TOTAL",
    "Estradiol": "ESTRADIOL,", "Tempo de Protrombina": "TEMPO DE PROTROMBINA,",
    "Dihidrotestosterona": "DIHIDROTESTOSTERONA", "IGFBP-3": "IGFBP-3 (",
    "Estrona": "ESTRONA (E1)", "Androstenediona": "ANDROSTENEDIONA,",
    "Dímeros D": "DIMEROS D,", "PTH": "PARATORMONIO (PTH)",
    "T3 livre": "TRIIODOTIRONINA (T3) LIVRE", "G6PD": "GLICOSE-6-FOSFATO DESIDROGENASE",
    "Sódio": "SODIO,", "Cobre": "COBRE,", "Cálcio": "CALCIO,",
    "Cálcio Ionizado": "CALCIO IONIZADO", "Ácido ascorbico, plasma": "ACIDO ASCORBICO,",
    "Vitamina A (retinol), soro": "VITAMINA A (retinol)", "Progesterona": "PROGESTERONA,",
    "Hemoglobina Glicada (A1C)": "HEMOGLOBINA GLICADA (A1C)"
}
UNITS = ("U/g hemoglobina", "ng/mL FEU", "microgramas/mL", "microgramas/dL",
         "micromol/L", "microg/dL", "microg/L", "milhões/mm3", "segundos",
         "mmol/L", "nmol/L", "pmol/L", "mcg/dL", "mg/dL", "ng/dL", "ng/mL",
         "pg/mL", "mUI/L", "mEq/L", "UI/mL", "U/mL", "UI/L", "mU/L",
         "ng/L", "mg/L", "g/dL", "U/L", "fL", "pg", "%", "mm")
MEASURE = re.compile(r"^\s{0,15}((?:inferior a\s+|superior a\s+|[<>]=?\s*)?"
                     r"[+-]?\d+(?:[.,]\d+)?)\s+(" + "|".join(re.escape(u) for u in UNITS) + r")(?=\s|$)", re.I)


def blocks_from_layout(text):
    blocks = []
    for page_no, page in enumerate(text.split("\f"), 1):
        prior = 0
        for receipt in re.finditer(r"^\s*RECEBIDO/COLETADO EM:\s*(\d{2}/\d{2}/\d{4})[^\n]*", page, re.M):
            body = page[prior:receipt.start()]
            prior = receipt.end()
            body = re.split(r"Assinatura digital avançada:[^\n]*\n", body)[-1]
            body = re.sub(r"^(?:Cliente:|Data de Nascimento:|Médico:)[^\n]*\n", "", body, flags=re.M)
            if "LAUDO EVOLUTIVO" in body or "RESULTADO" not in body:
                continue
            heading = re.split(r"Método:|RESULTADO|VALORES DE REFER", body, maxsplit=1)[0]
            body = re.split(r"\bNOTA(?:\(|:|\s+\d)|RESULTADOS ANTERIORES:", body, maxsplit=1)[0]
            collected = iso_date(receipt[1])
            if not collected:
                continue
            blocks.append({"heading": compact(heading), "body": body, "page": page_no,
                           "collection_date": collected})
    return blocks


def labeled(block, label, unit, style="comma", basis="result"):
    found = []
    for line in block["body"].splitlines():
        if ":" not in line or compact(line.split(":", 1)[0]) != compact(label).rstrip(" :"):
            continue
        tail = line.split(":", 1)[1].strip()
        match = re.match(r"([+-]?\d+(?:[.,]\d+)?)", tail)
        if match:
            if unit != "índice":
                suffix = tail[match.end():].lstrip()
                if basis == "table_header":
                    if not re.search(r"g/dL\s+%", block["body"]):
                        continue
                elif not suffix.startswith(unit):
                    continue
            found.append(result(match[1], unit, style, basis))
    return found


def parse_layout(text):
    output, unparsed = [], []
    report_dates = sorted({day for raw in re.findall(r"Impresso em:\s*(\d{2}/\d{2}/\d{4})", text)
                           if (day := iso_date(raw))})
    def emit(block, name, values):
        for value in values:
            output.append({"biomarker": name, "collection_date": block["collection_date"],
                           "pdf_page": block["page"], **value})

    for block in blocks_from_layout(text):
        heading, body = block["heading"], block["body"]
        before = len(output)
        for name, title in SIMPLE.items():
            if heading.startswith(compact(title)):
                matches = [m for line in body.splitlines() if (m := MEASURE.match(line))]
                # Extra differently unitized rows (e.g. PCR mg/L) are retained
                # outside this limited format; only the primary result is used.
                emit(block, name, [result(matches[0][1], matches[0][2])] if matches else [])

        if heading.startswith("hemograma"):
            cbc = {"Eritrócitos": ("ERITRÓCITOS", "milhões/mm3"), "Hemoglobina": ("HEMOGLOBINA :", "g/dL"),
                   "Hematócrito": ("HEMATÓCRITO", "%"), "HCM": ("HEMOGLOBINA CORPUSCULAR MÉDIA", "pg"),
                   "VCM": ("VOLUME CORPUSCULAR MÉDIO", "fL"), "CHCM": ("CORPUSCULAR MÉDIA:", "g/dL"),
                   "RDW": ("VOLUME ERITROCITÁRIO (RDW)", "%"),
                   "Plaquetas": ("TOTAL DE PLAQUETAS", "/mm3"), "Volume Médio Plaquetário": ("VOLUME PLAQUETÁRIO MÉDIO", "fL")}
            for name, (label, unit) in cbc.items():
                style = "grouped_count" if unit == "/mm3" else "comma"
                emit(block, name, labeled(block, label, unit, style))
            for line in body.splitlines():
                if compact(line).startswith("leucocitos"):
                    m = re.match(r"\s*LEUCÓCITOS\s+(\d[\d.]*)", line, re.I)
                    if m:
                        emit(block, "Leucócitos", [result(m[1], "/mm3", "grouped_count", "table_header")])
                for cell in ["Neutrófilos", "Eosinófilos", "Basófilos", "Linfócitos", "Monócitos"]:
                    if compact(line).startswith(fold(cell)) and ":" in line:
                        m = re.match(r"\s*(\d+(?:,\d+)?)\s+(\d[\d.]*)\s", line.split(":", 1)[1])
                        if m and "/mm3" in body and "%" in body:
                            emit(block, cell + " (%)", [result(m[1], "%", unit_basis="table_header")])
                            emit(block, cell, [result(m[2], "/mm3", "grouped_count", "table_header")])

        if heading.startswith("eletroforese das proteinas") and re.search(r"g/dL\s+%", body):
            names = {"ALBUMINA": "Albumina (eletroforese)", "ALFA-1 GLOBULINAS": "Alfa-1 globulina",
                     "ALFA-2 GLOBULINAS": "Alfa-2 globulina", "BETA-1 GLOBULINAS": "Beta-1 globulina",
                     "BETA-2 GLOBULINAS": "Beta-2 globulina", "GAMA GLOBULINAS": "Gama globulina"}
            for line in body.splitlines():
                for label, name in names.items():
                    if compact(line).startswith(fold(label)) and ":" in line:
                        m = re.match(r"\s*(\d+,\d+)\s+\(\s*(\d+\.\d+)\)", line.split(":", 1)[1])
                        if m:
                            emit(block, name, [result(m[1], "g/dL", unit_basis="table_header")])
                            percent_name = "Albumina (eletroforese, %)" if label == "ALBUMINA" else name + " (%)"
                            emit(block, percent_name, [result(m[2], "%", "dot", "table_header")])
            emit(block, "Proteína Total (eletroforese)", labeled(block, "TOTAL", "g/dL", basis="table_header"))
            emit(block, "Relação Albumina/Globulina (eletroforese)", labeled(block, "RELAÇÃO ALBUMINA/GLOBULINA", "índice", basis="dimensionless_calculation"))

        composites = {
            "saturacao da transferrina": [("Ferro", "Ferro", "mcg/dL"), ("Capacidade Total de Ligação do Ferro", "Ligação do ferro, capacidade total", "mcg/dL"), ("Saturação Transferrina", "Saturação da Transferrina", "%")],
            "bilirrubinas": [("Bilirrubina direta", "DIRETA", "mg/dL"), ("Bilirrubina indireta", "INDIRETA", "mg/dL"), ("Bilirrubina total", "TOTAL", "mg/dL")],
            "proteina total e fracoes": [("Proteína Total", "PROTEINA TOTAL", "g/dL"), ("Albumina", "ALBUMINA", "g/dL"), ("Globulinas", "GLOBULINAS", "g/dL"), ("Relação Albumina/Globulina", "ALBUMINA/GLOBULINAS", "índice")],
            "tempo de tromboplastina parcial ativada": [("Tempo de Tromboplastina Parcial Ativada", "RESULTADO", "segundos"), ("Relação TTPA paciente/normal", "RELACAO PACIENTE/NORMAL", "índice")],
            "tempo de protrombina": [("INR", "INR", "índice")],
            "insulina,": [("HOMA-IR", "Cálculo do HOMA-IR", "índice")],
            "apolipoproteina b,": [("Relação ApoB/ApoA1", "Razão Apo B / Apo A1", "índice")],
            "hemossedimentacao": [("VHS (1ª hora)", "PRIMEIRA HORA", "mm")],
            "antigeno prostatico especifico": [("PSA Total", "PSA Total", "ng/mL"), ("PSA Livre", "PSA Livre", "ng/mL"), ("Relação PSA Livre/Total", "Relacao PSA livre/PSA total", "índice")]
        }
        for prefix, cells in composites.items():
            if heading.startswith(prefix):
                for name, label, unit in cells:
                    emit(block, name, labeled(block, label, unit, basis="dimensionless_calculation" if unit == "índice" else "result"))
        if heading.startswith("hemoglobina glicada"):
            m = re.search(r"de\s+(\d+)\s+mg/dL\.", body)
            if m:
                emit(block, "Glicemia Média Estimada", [result(m[1], "mg/dL", unit_basis="reported_calculation")])
        qualitative = {
            "antigeno e do virus da hepatite b": ("Hepatite B - HBeAg", None),
            "sifilis, anticorpos": ("Sífilis - VDRL", None),
            "hepatite b, anticorpo contra antigeno de superficie": ("Hepatite B - Anti-HBs", "UI/L"),
            "anticorpos anti-virus da hepatite c": ("Sorologia HCV", None)
        }
        for prefix, (name, unit) in qualitative.items():
            if heading.startswith(prefix):
                lines = [line.strip().split("  ")[0] for line in body.splitlines()
                         if re.match(r"^\s{0,15}não reagente", line, re.I)]
                if len(lines) == 1:
                    raw = lines[0]
                    if name == "Sorologia HCV":
                        m = re.search(r"^\s*Índice:\s*(\d+,\d+)", body, re.M)
                        if not m:
                            continue
                        raw += "; índice " + m[1]
                    if unit and unit not in body:
                        continue
                    emit(block, name, [result(raw, unit, unit_basis="assay_reference" if unit else "qualitative")])
        if len(output) == before:
            unparsed.append({"pdf_page": block["page"], "heading": heading, "reason": "unsupported_layout"})
    return {"rows": output, "unsupported_blocks": unparsed, "document_print_dates": report_dates}


def same_numeric(a, b):
    if a is None or b is None:
        return a is None and b is None
    try:
        return Decimal(str(a)) == Decimal(str(b))
    except InvalidOperation:
        return False


def same_unit(a, b):
    # Spellings only, never scale conversions; case remains significant.
    aliases = {"mcg/dL": "microg/dL"}
    return aliases.get(a, a) == aliases.get(b, b)


def compare_expected(parsed, expected, sha256):
    findings = []
    for row in expected:
        errors = []
        if row.get("sha256") != sha256:
            errors.append("source_hash_mismatch")
        if row.get("report_date_kind") == "report_print_date" and row.get("report_date") not in parsed["document_print_dates"]:
            errors.append("document_print_date_mismatch")
        page = row.get("pdf_page")
        candidates = [p for p in parsed["rows"] if p["biomarker"] == row.get("biomarker")
                      and p["collection_date"] == row.get("collection_date")
                      and str(p["pdf_page"]) == str(page)]
        # Same-page standalone/combined assay copies may repeat an identical
        # result. Collapse only equal signatures; never select between conflicts.
        unique = {}
        for candidate in candidates:
            signature = (Decimal(candidate["result_numeric"]) if candidate["result_numeric"] is not None else compact(candidate["result_raw"]),
                         candidate["result_numeric"] is None, candidate["unit"], candidate["decimal_style"])
            unique.setdefault(signature, candidate)
        candidates = list(unique.values())
        if len(candidates) != 1:
            errors.append("missing_or_ambiguous_source_result")
        else:
            source = candidates[0]
            if not same_numeric(source["result_numeric"], row.get("result_numeric")):
                errors.append("numeric_result_mismatch")
            if source["result_numeric"] is None and compact(source["result_raw"]) != compact(row.get("result_raw")):
                errors.append("qualifier_or_qualitative_mismatch")
            if not same_unit(source["unit"], row.get("unit")):
                errors.append("unit_mismatch")
            # Also compare source raw numeric notation independently of DB numeric.
            if row.get("numeric_kind") == "exact" and not same_numeric(
                    numeric(row.get("result_raw"), source["decimal_style"]), source["result_numeric"]):
                errors.append("raw_numeric_mismatch")
        findings.append({"source_record_id": row.get("source_record_id"), "biomarker": row.get("biomarker"),
                         "pdf_page": page, "status": "verified" if not errors else "review_required", "issues": errors})
    return findings


def private_output(path):
    target = Path(path).resolve()
    checkout = Path(__file__).resolve().parents[1]
    if target.is_relative_to(checkout):
        raise ValueError("private_audit_output_must_be_outside_a_repository")
    return target


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--pdf", required=True)
    cli.add_argument("--expected", help="Private JSON array from the dedicated app; no database access is performed.")
    cli.add_argument("--output", required=True, help="Private JSON path outside this tool's source checkout.")
    args = cli.parse_args()
    target = private_output(args.output)
    pdf = Path(args.pdf)
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    completed = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True)
    text = completed.stdout.decode("utf-8")
    parsed = parse_layout(text)
    expected = json.loads(Path(args.expected).read_text()) if args.expected else None
    findings = compare_expected(parsed, expected, digest) if expected is not None else []
    conflicts = []
    groups = {}
    for row in parsed["rows"]:
        groups.setdefault((row["biomarker"], row["collection_date"]), []).append(row)
    for (marker, day), rows in groups.items():
        signatures = {(compact(r["result_raw"]) if r["result_numeric"] is None else Decimal(r["result_numeric"]),
                       r["result_numeric"] is None, r["unit"]) for r in rows}
        if len(signatures) > 1:
            conflicts.append({"biomarker": marker, "collection_date": day, "reason": "conflicting_source_copies"})
    document = {"schema": "fleury_offline_source_audit_v1", "read_only": True,
                "production_import_enabled": False, "source_sha256": digest,
                "page_count": len(text.rstrip("\f\n").split("\f")), **parsed,
                "conflicts": conflicts, "findings": findings}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    target.chmod(0o600)
    # Stdout deliberately contains no personal row data or source identifiers.
    unresolved = any(f["status"] != "verified" for f in findings) or bool(conflicts)
    print("Fleury source audit: review required" if unresolved else "Fleury source audit: completed")
    return 1 if unresolved else 0


if __name__ == "__main__":
    raise SystemExit(main())
