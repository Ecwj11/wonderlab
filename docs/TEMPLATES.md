# Student portal templates

Wonderlab offers three child-friendly visual templates. Templates change presentation while preserving the same lesson content, trusted interaction components, authentication and progress rules.

| ID | Direction | Preview | Hero artwork |
| --- | --- | --- | --- |
| `playground` | Bright learning playground with sky blue, coral, lemon yellow and mint | `/templates/playground-preview.png` | `/templates/playground-hero.png` |
| `space` | Space exploration with deep blue, violet, stars and friendly planets | `/templates/space-preview.png` | `/templates/space-hero.png` |
| `clay` | Warm, tactile clay illustration with pastel colors and rounded shapes | `/templates/clay-preview.png` | `/templates/clay-hero.png` |

The preview images are approved design references, not screenshots of the live application. The implemented interface retains real lesson titles, learning statistics and navigation. Hero PNGs are generated decorative artwork with transparent backgrounds; they do not contain generated HTML, executable code or lesson answers.

## Selection and permissions

The current selection is a site-wide setting stored in MySQL `system_settings` under the appearance configuration. The backend validates the template ID against `playground`, `space` and `clay`; arbitrary asset paths, CSS and HTML cannot be saved as a template.

- `GET /admin/appearance` reads the current configuration for authorized administrators.
- `PATCH /admin/appearance` saves an administrator's selected template.
- Authenticated `GET /appearance` returns the selected template for the student portal.
- An administrator can preview a template at `/app?previewTemplate=ID` without changing the site-wide selection.

All browser requests use the existing same-origin `/api/*` proxy. The backend URL and authorization checks remain server-side. Selecting a student portal template does not change the professional admin layout.

Student accounts cannot write the appearance setting or use the administrator preview override. Future personal template selection can add a validated user preference and resolve appearance in the order: personal preference, site default, `playground`. That extension should reuse the same template registry and assets without changing the lesson schema or AI generation pipeline.

## Content and asset boundaries

Lesson JSON remains the source of educational content. The interaction registry renders safe React components for fractions, timelines, diagrams and quizzes. Templates supply palette, typography, decoration and artwork around those components. Switching templates never regenerates a lesson or resets learning progress.

Final assets live in `frontend/public/templates/`, so builds and Docker deployments do not depend on files in the image generator's workspace. Concept previews and hero illustrations were produced with the built-in image generation tool. Generated transparency is preserved by copying the PNG files without image edits.

The hero illustrations are 1,254 × 1,254 RGBA PNGs. Each was inspected after copying and verified to contain both transparent and opaque pixels. Original hero sizes are approximately 1.72 MB for playground, 1.64 MB for space and 1.41 MB for clay; the frontend image component can optimize delivered formats and sizes. Concept previews are approximately 1.61 MB, 1.76 MB and 1.71 MB respectively.

Artwork prompt direction: create one friendly child-focused hero illustration per approved visual direction, with a transparent background, a clear central learning mascot and decorative learning objects. Match the playground, space and clay styles respectively; avoid interface text, logos, watermarks and baked-in UI controls. Exact prompts are recorded by the generation tool in the task history.

When adding a template, introduce a validated ID, trusted styles and bundled assets together. Do not accept AI-generated HTML or arbitrary custom CSS as a template definition.
