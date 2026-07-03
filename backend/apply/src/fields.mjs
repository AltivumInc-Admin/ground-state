/*
 * The single source of truth for the application's field set. The /apply form,
 * this backend's validation (handler.mjs), the stored record (store.mjs), and
 * the operator notification (email.mjs) all carry the same eight fields —
 * adding or renaming a form field means changing ONE record here, and the
 * drift test in test/fields.test.mjs proves it reaches every sink.
 *
 * caps mirror the form's maxLength attributes (src/pages/Apply.jsx) — length-
 * bounded, not value-allowlisted, so the backend doesn't couple to the
 * frontend's select option copy. The email field is validated separately in
 * handler.mjs (format regex + its cap here); `email: true` marks it.
 */
export const APPLICATION_FIELDS = [
  { key: 'name', cap: 200, label: 'Name' },
  { key: 'email', cap: 320, label: 'Email', email: true },
  { key: 'company', cap: 200, label: 'Company' },
  { key: 'role', cap: 200, label: 'Role' },
  { key: 'applicantType', cap: 100, label: 'Applying as' },
  { key: 'stage', cap: 100, label: 'Funding stage' },
  { key: 'modality', cap: 100, label: 'Modality' },
  { key: 'want', cap: 2000, label: 'What they want from the room' },
]
