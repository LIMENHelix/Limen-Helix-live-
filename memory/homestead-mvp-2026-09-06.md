# Homestead MVP decisions (2026-09-06)

- Economy Watch stays the generated shell. Homestead is a section on /economy plus /economy/homestead. Soft 3 (culture/religion/education) is not rewritten.
- Desk Alerts (~$19/mo) are a waitlist, not a Stripe SKU. County auction data is not honest enough to charge. Economy L1 $4 p2 is the only live checkout.
- Stage clock is educational from the notice the visitor names. Place is Zippopotam / Census geocoder. Auction date is always null.
- On-page chat is FAQ-first. Grok only if LIMEN_AI_ENABLED=1 and XAI_API_KEY or GROK_API_KEY. No SMS/voice.
- Analytics are five POST events on /api/homestead-events (read_complete, email_capture, chat_open, chat_qualified, checkout_start).
