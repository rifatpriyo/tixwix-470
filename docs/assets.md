# Visual asset provenance

`public/concert.png` was created with the built-in image-generation tool for this milestone. It is decorative synthetic photography, not evidence of a real TixWix event, customer, or booking. No fake statistics or event listings are shown.

Prompt used:

> Create a photorealistic editorial photograph for the TixWix event platform landing page. Portrait 4:5 composition. View from behind a small concert audience toward a distant stage, dramatic but restrained teal stage lighting, charcoal shadows, subtle film grain, authentic concert atmosphere. No identifiable celebrities, no logos, no text, no UI, no watermarks. This is decorative brand photography, not a specific real event. Keep a strong luminous stage in the upper middle and audience silhouettes in the bottom third.

Geist fonts are self-hosted from `@fontsource/geist`; Radix icons supply interface icons. shadcn/ui source components were installed using its official CLI and customized through TixWix theme tokens. The generated `cn` imports were corrected to the local `src/lib/utils.ts` helper; the unneeded external `cn` dependency was removed.

`docs/images/homepage.png` is an existing screenshot of the actual local application's public landing page, selected for the README during the 5 November 2026 documentation refresh. It contains no signed-in account information. The concert image within it is the decorative asset described above. This documentation image is separate from generated browser test reports, which remain excluded from Git.
