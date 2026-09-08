export default function CampaignsPage() {
  return (
    <div>
      <h1>Campagnes de recensement</h1>
      <p className="muted">
        Les campagnes sont gérées via <code>/api/v1/census/campaigns</code>. Cette page
        affichera la liste live une fois branchée au store ONIP.
      </p>
      <div className="panel">
        <p>Placeholder — brancher GET /census/campaigns.</p>
      </div>
    </div>
  );
}
