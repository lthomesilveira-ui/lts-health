// Deliberately fictional IDs, dates, hashes, people and nutrient values only.
export const syntheticOwner = '11111111-1111-4111-8111-111111111111';
export const syntheticOtherOwner = '22222222-2222-4222-8222-222222222222';

export function syntheticManifest() {
  const sourceRecordId = 'synthetic:nutrition-document:new';
  const date = '2025-02-12';
  const checksum = 'a'.repeat(64);
  const totals = { calories_kcal: 500, protein_g: 25, carbs_g: 60, fat_g: 15, fiber_g: 8 };
  const nutritionPlan = {
    schema_version: 1, type: 'documented_nutrition_plan',
    documented_on: date, received_on: date, source_record_id: sourceRecordId,
    source_sha256: checksum, page_count: 2, clinical_start: null, clinical_start_status: 'not_documented',
    verification: { status: 'source_verified', pages: [1, 2] },
    author: { name: 'Synthetic Author', identification_basis: 'printed_logo', source_pages: [1], signature_verified: false },
    daily_targets: Object.fromEntries([
      ['calories_kcal', 2000, 'kcal'], ['protein_g', 100, 'g'], ['carbs_g', 250, 'g'],
      ['fat_g', 60, 'g'], ['fiber_g', 25, 'g'], ['water_ml', 2400, 'mL'],
    ].map(([key, value, unit]) => [key, { value, unit, pages: [2] }])),
    meals: [{ id: 'meal-1', name: 'Synthetic meal', time: '08:00', source_pages: [1], items: [{ name: 'Synthetic food', quantity: 100, unit: 'g' }], totals, notes: ['Synthetic preparation note.'] }],
    alternatives: [{ name: 'Synthetic alternative', replaces_meal_id: 'meal-1', source_pages: [2], items: [{ name: 'Alternative synthetic food', quantity: 120, unit: 'g' }], totals: { ...totals, fiber_g: null }, notes: [] }],
    substitutions: [{ text: 'Synthetic substitution.', source_pages: [1] }],
    notes: [{ text: 'Synthetic source note.', source_pages: [2] }], arithmetic_notes: [],
  };
  return {
    ownerUserId: syntheticOwner,
    anchorSourceRecordId: 'synthetic:existing:anchor',
    expectedDocsCount: 2,
    expectedDocsHash: '0'.repeat(32), // Replaced with PostgreSQL's actual synthetic snapshot by integration tests.
    newRow: {
      source_record_id: sourceRecordId, document_date: date, title: 'Synthetic documented nutrition plan',
      document_type: 'nutrition_plan', source_file: 'synthetic-nutrition-plan.pdf', source: 'Synthetic source',
      checksum, extraction_status: 'validated', confidence: 'source_verified', notes: 'Fictional CI record only.',
      source_payload: { nutrition_plan_ui: nutritionPlan, fixture: true },
    },
  };
}
