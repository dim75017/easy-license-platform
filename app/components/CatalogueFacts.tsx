import { CatalogueMetric } from "./CatalogueMetric";

export function CatalogueFacts() {
  return (
    <section className="catalogue-facts home26-facts" aria-label="Symbiome catalogue facts" data-reveal="group">
      <div><strong><CatalogueMetric metric="tracks" /></strong><span>published tracks ready to listen</span></div>
      <div><strong><CatalogueMetric metric="artists" /></strong><span>artists in the live catalogue</span></div>
      <div><strong><CatalogueMetric metric="genres" /></strong><span>genres in the live catalogue</span></div>
      <div><strong>0</strong><span>AI-generated tracks accepted</span></div>
    </section>
  );
}
