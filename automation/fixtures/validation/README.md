# Validation fixtures

Small, versioned examples for regression testing validation behavior. `test_validation_fixtures.py` now guards that pricing stays removed (all pricing removed 2026-10-02).

| File | Purpose |
|------|---------|
| `sample_event_kno.json` | Minimal event-shaped dict (KNO) for local experiments |

Run checks:

```bash
cd automation
python test_validation_fixtures.py
```

Requires no Supabase credentials — tests use mocks.
