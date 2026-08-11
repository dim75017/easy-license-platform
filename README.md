# Symbiome

Symbiome is a high-quality instrumental music platform for creators and
businesses, powered by Lofi Girl. It brings creator subscriptions, commercial
sync enquiries and a future retail offer into one clear product.

## Included in this V1

- Public website with product story, catalogue preview and pricing
- Creator and Creator Pro subscription positioning
- Sync licensing for existing music and custom music briefs
- Music for Retail waitlist
- Interactive creator workspace with catalogue, licences and channel views
- Interactive admin workspace for licences, catalogue, sync and retail leads
- D1-backed lead collection API with validation and restricted admin reads
- Responsive layouts for desktop, tablet and mobile

The workspaces currently use demonstration data. Authentication, payments,
production catalogue ingestion and rights-management integrations remain to be
connected before a commercial launch.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run build
npm run lint
npm test
```

## Data

`.openai/hosting.json` declares the `DB` D1 binding. The lead schema lives in
`db/schema.ts`, and migrations are generated in `drizzle/`.

```bash
npm run db:generate
```

## Product principles

- The licence is the product: clarity, proof and support over technical jargon.
- Existing artist permissions remain protected.
- The catalogue is human-made; generative-AI music is excluded.
- Commercial sync offers both existing tracks and custom music in one flow.

## Brand

Symbiome is an independent product presented as “Powered by Lofi Girl”.
All customer-facing copy is in English.
