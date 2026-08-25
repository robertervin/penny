# Messages for Business local prototype

Minimal stand-in for Apple Messages for Business interactive UI so we can prototype Penny’s audit without an MSP.

## What it simulates

| MfB feature | In this tool |
|---|---|
| Quick Reply | Chip buttons under the thread |
| List Picker | Bottom sheet with sections / checkmarks |
| Form | Bottom sheet with input pages |
| `interactiveData` JSON | Shown in the left debug panel |

Payload field names intentionally track Apple’s interactive dictionaries so an MSP swap is mostly transport.

## Run

```bash
cd tools/mfb-prototype
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open http://localhost:5173 — walk the scripted audit (runway → debt list picker → goals → plan).
