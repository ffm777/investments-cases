# Chapter 2 instructor solution

The instructor overview links to this six-view classroom presentation. The solution content in `solution.enc.json` is encrypted with AES-256-GCM, using a PBKDF2-SHA-256 key derived from the existing instructor access key (600,000 iterations, random 16-byte salt and 12-byte IV). The key is not in this repository. The browser decrypts only after a valid key is entered or reused from the current instructor tab. No extra service or account is required.

Use the instructor overview, sign in, and open **Instructor solution**. **Reveal next step** or Space reveals the current explanation; the view selector and arrow keys move between views. **Full solution** shows all explanations and the optional extension. **Print / PDF** prints the complete solution regardless of the currently revealed steps. **Lock** clears the decrypted content and the shared tab access key.

Publish only the shell, styles, script and encrypted payload from this folder. Keep the editable plaintext teaching source outside the public repository. After editing that source or rotating the instructor key, regenerate the authenticated encrypted payload and republish it. Do not add an unencrypted copy, a password, or a derived encryption key to the public files. Existing student-page worked examples and client-side answer checking remain available; this presentation is not an exam-security boundary.

Validation covered all six views at 1280 by 720 pixels, staged reveals, keyboard navigation, handout view, lock/unlock, wrong-key rejection, tampered-payload rejection, automatic unlock from the instructor overview, and independent reconciliation of the three valuation formulas with individually discounted cash flows.
