export default function CivilPortal() {
  return (
    <div>
      <h1>Portail État civil</h1>
      <div className="panel">
        <p>
          Interface commune pour la recherche population (référence), la saisie d’actes
          et le suivi des déclarations hospitalières.
        </p>
        <p className="muted">API cible : <code>/api/v1/civil/*</code> (Phase 4).</p>
      </div>
    </div>
  );
}
