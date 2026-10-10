# Student interface languages

The student portal supports `en` (English), `zh` (Simplified Chinese) and `en-zh` (English and Chinese together). Each authenticated user owns their choice; it is independent of the administrator's site-wide visual template. Migration `006_ui_language.sql` adds the relational `users.ui_language` column, defaulting existing and new users to English.

Browser requests use the same-origin proxy. `GET /api/preferences` reads the current account's `{ uiLanguage }`; `PATCH /api/preferences` saves that strict, validated object. The backend derives the account ID from the authenticated session. Unsupported languages, extra fields and attempts to supply another account ID are rejected.

The language selector in the student header saves immediately. A failed save restores the previous display language and shows a retry message. The frontend uses a curated translation dictionary and explicit localization components, without mutating the DOM or injecting generated markup. Bilingual text uses English above Chinese where space allows; compact attributes and options include both languages inline. Responsive styling allows the extra text to wrap.

Interface language and lesson content language are separate. Course titles and generated educational content keep the language chosen when the lesson was generated; this release localizes interface labels, navigation, learning controls and guidance. It does not silently translate arbitrary AI lesson content. A later bilingual content contract should store validated translations with each lesson version and preserve question/scene identity, answer keys and completion rules.

The admin portal keeps its professional English interface. All three student templates use the same localization components.
