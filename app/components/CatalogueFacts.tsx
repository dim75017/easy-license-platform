import { lofiGirlPlaylists } from "../data/catalog";

const featuredGenreCount = new Set(lofiGirlPlaylists.map((playlist) => playlist.genre)).size;

export function CatalogueFacts() {
  return (
    <section className="catalogue-facts home26-facts" aria-label="Symbiome catalogue facts" data-reveal="group">
      <div><strong>10,000+</strong><span>instrumental and background tracks</span></div>
      <div><strong>1,000+</strong><span>artists represented worldwide</span></div>
      <div><strong>{featuredGenreCount}</strong><span>music genres across our featured playlists</span></div>
      <div><strong>0</strong><span>AI-generated tracks accepted</span></div>
    </section>
  );
}
