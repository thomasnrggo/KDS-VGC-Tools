const TWITTER_URL = "https://x.com/AnthosVGC";

export function Footer() {
  return (
    <footer className="bg-mauve-100 px-6 py-4 text-center text-xs text-mauve-700">
      <p className="font-medium">
        VGC Tools developed by AnthosVGC [
        <a
          href={TWITTER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-mauve-900 underline hover:text-mauve-700"
        >
          Twitter
        </a>
        ]
      </p>
      <p className="mt-1 text-mauve-500">
        All images and data used on this site are owned by Pokémon and its
        subsidiaries. This site is not affiliated with The Pokémon Company, Game
        Freak, ILCA, or Nintendo in any way.
      </p>
    </footer>
  );
}
