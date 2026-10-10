# Malaysian sample lesson collection

Requested on 2026-10-06 for Malaysian primary school children. All seven lessons were submitted through `/api/lessons/generate` with `AI_PROVIDER=codex`. Active Codex session subagents author the analysis, shared plans and scene refinements through the durable bridge. These are real generated lessons, not MockAIProvider fixtures. No application code or provider settings were changed for this collection.

The collection uses Bahasa Melayu for history/geography and English for mathematics, science and general learning. School levels are approximate intended ages, not a claim of official curriculum certification. Every lesson starts with a supported playable game. The existing interface language preference is independent of lesson content language.

| Subject     | Lesson                                     | Language      | Intended learners    | Lesson ID                            |
| ----------- | ------------------------------------------ | ------------- | -------------------- | ------------------------------------ |
| Mathematics | Pasar Malam Number Adventure               | English       | Year 1–3, ages 7–9   | 25756e1d-32f4-44a9-b72e-f672cf258d47 |
| Science     | Our School Garden: The Leaf Food Factory   | English       | Year 4–6, ages 10–12 | f9bdbb24-a8dd-484e-9a50-71f46d1b450c |
| History     | Misi Merdeka: 1957 dan 1963                | Bahasa Melayu | Year 4–6, ages 10–12 | 5e7f0574-80ea-4f02-9df0-42eade6dfddb |
| History     | Detektif Warisan: Melaka dan George Town   | Bahasa Melayu | Year 4–6, ages 10–12 | b55106de-6685-4317-bb7c-251872076e36 |
| Geography   | Jelajah Malaysia: Negeri, Wilayah dan Laut | Bahasa Melayu | Year 4–6, ages 10–12 | fcba7d77-7b9a-4d39-96d7-b00d4ef15aa8 |
| Geography   | Cuaca Malaysia: Misi Monsun                | Bahasa Melayu | Year 4–6, ages 10–12 | 9a67bb1e-5a1d-48f4-bc0d-476e6a8238c7 |
| General     | Good Neighbours: Our Malaysian School      | English       | Year 1–4, ages 7–10  | 0e4894b0-c700-42f3-8b1e-83941ae4ba27 |

## Source review

Source content was written in original, child-friendly wording. History distinguishes the independence of the Federation of Malaya from the formation of Malaysia; it does not present Sabah and Sarawak as becoming independent in 1957. Geography distinguishes states from federal territories and the peninsula from Sabah and Sarawak. Monsoon dates describe typical seasonal patterns, rather than a forecast or exact annual start date. General learning uses inclusive classroom examples without assigning behaviours to ethnic groups.

Historical dates and places were checked against [Arkib Negara's independence-date record](https://ofa.arkib.gov.my/ofa/group/asset/1215061), its [independence proclamation material](https://pustakailmu.arkib.gov.my/index.php/ms/pustaka-ilmu/imbasan-fakta/dokumen-perisytiharan-kemerdekaan?page=1), and [formation-of-Malaysia account](https://pustakailmu.arkib.gov.my/index.php/ms/pustaka-ilmu/imbasan-fakta/pemasyhuran-malaysia-lahirnya-sebuah-negara).

The heritage lesson uses [UNESCO's Melaka and George Town listing](https://whc.unesco.org/en/list/1223). Geography uses [Malaysia's administrative/geographical report to UNGEGN](https://unstats.un.org/unsd/geoinfo/ungegn/docs/11th-uncsgn-docs/E_Conf.105_109_CRP.109_9_TG%20for%20Malaysia_annex..pdf). Weather concepts use [MET Malaysia's weather phenomena](https://www.met.gov.my/pendidikan/fenomena-cuaca/) and [climate overview](https://www.met.gov.my/pendidikan/iklim-malaysia/).

## Interaction scope

Arithmetic uses the existing 2D forest platform game. Other subjects now use semantic 2D adventures: walk and jump through an illustrated subject world, collect clues, choose meanings, solve all missions, build a bridge and physically reach the exit. Relevant timelines, plant exploration or short quizzes support the game. Geography samples teach locations and weather concepts through exploration missions and quizzes; the current engine has no full geographical map or climate simulation renderer. These lessons contain validated structured JSON and trusted components, not generated executable code.

## Publication and verification

All seven jobs completed with provider `codex`, and the lesson definitions passed the pipeline's strict schema validator. After content review and browser play checks, each sample was published with PUBLIC visibility for the student Library. The admin owner also sees them in My Lessons. Originals remain unstarted at 0% progress.

Browser preview used temporary private duplicates. Every memory game was played to victory (40 semantic pairs across seven matching scenes). The maths game responded to movement and cycled walking frames; the five configured addition missions use validated operands. All four Merdeka timeline events and all three plant parts were explored. All 26 quiz questions returned correct immediate feedback through the real API. Quiz results and lesson completion were not submitted during preview, so verification awarded no XP. Preview duplicates were deleted.

The content review checks distinguish national capital from administrative centre, Malaya's independence from Malaysia's formation, typical monsoon months from specific forecasts, and two heritage cities from their shared UNESCO listing. Existing source facts and answers were reviewed rather than relying on schema validity alone.

An isolated student sign-in confirmed all seven samples are discoverable in Library and readable by students, while quiz answer keys and private source columns stay hidden. The initial collection created lesson/job data and documentation; the subsequent 2D subject extension changes trusted frontend presentation and generation instructions.

## 2D subject upgrade

On 2026-10-06 the science, two history and two geography samples were regenerated by one real Codex session content subagent. All five jobs completed and published validated version 2, preserving their lesson IDs and PUBLIC visibility. Each opens with six clue missions and a brief supporting diagram, timeline or quiz. The GENERAL sample retains its original real-authored version: the existing daily generation allowance rejected regeneration, so its semantic pairs use the new trusted 2D renderer directly. Its stored legacy card instructions are overridden by the renderer's accurate movement/mission instructions. No quota bypass or provider switch was made. Maths remains unchanged.

| Sample             | Regeneration job                     |
| ------------------ | ------------------------------------ |
| Science garden     | b5eb9fa3-18cc-4993-b4a4-f796421fe67c |
| Misi Merdeka       | 93db6965-abe9-438d-ab99-a41e3ffb2bf0 |
| Heritage           | 1c5420a6-7713-4612-949a-a01cf0110974 |
| Malaysia geography | 348df57b-0bd7-42fb-90a2-a5c4af2c2af1 |
| Monsoons           | 4b3b00a6-e70d-48d4-b76d-32eb5e0dd27b |

The content subagent authored 20 analysis/plan/specialist outputs through 40 successful bridge claim/completion calls. Reviewed version-2 facts preserve the source distinctions above. Four individually generated backgrounds are documented in [asset provenance](SUBJECT_ADVENTURE_ASSETS.md); these are stylised game scenes, not accurate maps or historical reconstructions.

Production browser play completed six clue missions and the physical exit in all four subject worlds using private duplicates. Science also completed its supporting plant exploration, saved 100% and +50 XP, and received no additional XP on repeat submission. Desktop camera, wrong-answer retries, keyboard navigation after victory, reduced-motion walking, native touch/cancellation and 390px bilingual layout were verified. Verification copies were removed; original samples remain at 0%. A student session confirmed all six appear in Library, remain readable and hide quiz keys. See [verification](VERIFICATION.md).
