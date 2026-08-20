# Generated briefing contract

`briefing-item.schema.json` is the machine-readable contract for briefing items produced by a future LLM/backend pipeline. `data-validator.js` is the browser/runtime enforcement layer for the same structure plus product-specific safety checks.

## Required fields

Every generated item must provide:

- `title`
- `metric.value`, `metric.dir`, `metric.sub`
- at least one `fact`
- at least one Telegram `source` key (`channel/messageId`)
- `notes` (may be empty)
- `opinion`

Globe issues additionally use `id`, `region`, `cat`, and `imp`. Map/card cards may use `tag`, `short`, and expanded term objects.

## Information-layer rules

1. **Facts** must be grounded in referenced source messages. The schema requires source identifiers; the runtime validator rejects missing references.
2. **Explanation** (`terms`, `notes`) may explain concepts/background but must not be presented as source facts.
3. **Opinion** may interpret the event but must not contain investment-judgement language such as buy/sell recommendations or target-price recommendations.
4. Rich text is deliberately tiny: only `<b>...</b>` emphasis is allowed. Other HTML is rejected by the validator and rendered as literal text by `renderRichText()`.

## Metric direction

Allowed values are `up`, `down`, `flat`, `neutral`, and `none`. `none` is useful for events where a directional market move is not meaningful (for example, an unconfirmed rumor).

## Integration rule

Generated content should be validated with:

```js
const errors = window.BRIEFING_VALIDATION.validateGeneratedItem(item, sources);
```

Only items with `errors.length === 0` should be admitted to the canonical briefing dataset/API response.
