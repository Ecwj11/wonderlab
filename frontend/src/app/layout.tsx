import type { Metadata } from 'next';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './globals.css';
import './kids.css';
import './templates.css';
import './i18n.css';
import './games.css';
import './forest.css';
import './subject-adventure.css';
import './lesson-status.css';
import './agents.css';
import './family.css';
import './portal-login.css';
import './music.css';
import './rewards.css';
import './story-game.css';
import { SoundProvider } from '@/components/sounds';
import './sounds.css';
import { MusicProvider } from '@/components/music';
export const metadata: Metadata = {
  title: { default: 'Wonderlab · A little curiosity goes a long way', template: '%s · Wonderlab' },
  description:
    "Don't just read it. Experience it. Turn learning into an adventure with interactive lessons, explorations and quizzes.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SoundProvider>
          <MusicProvider>{children}</MusicProvider>
        </SoundProvider>
      </body>
    </html>
  );
}
