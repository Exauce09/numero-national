/** Placeholder — GET /api/v1/me/card + report-lost */
export default function CardPage() {
  return (
    <section>
      <h1>Carte nationale</h1>
      <p>Statut de la carte, QR minimal signé, déclaration de perte.</p>
      <div className="placeholder">
        À brancher sur <code>GET /api/v1/me/card</code> et{" "}
        <code>POST /api/v1/me/card/report-lost</code>
      </div>
    </section>
  );
}
