import Link from 'next/link';
export default function NotFound() {
  return (
    <main style={{ padding: 80, textAlign: 'center' }}>
      <h1>A little off the learning path.</h1>
      <p>We couldn't find this page.</p>
      <Link href="/app">Back to your dashboard</Link>
    </main>
  );
}
