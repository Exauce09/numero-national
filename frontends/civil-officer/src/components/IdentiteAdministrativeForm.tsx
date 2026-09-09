import {
  TYPES_DOCUMENT,
  emptyDocument,
  type IdentiteAdminData,
} from "../identiteAdministrative";

type Props = {
  value: IdentiteAdminData;
  onChange: (next: IdentiteAdminData) => void;
};

export default function IdentiteAdministrativeForm({ value, onChange }: Props) {
  return (
    <div className="situation-familiale">
      <fieldset className="id-fieldset">
        <legend>Référence dossier</legend>
        <div className="form-grid">
          <div>
            <label className="form-label">N° administratif / dossier</label>
            <input
              className="form-control"
              value={value.numero_dossier}
              onChange={(e) => onChange({ ...value, numero_dossier: e.target.value })}
              placeholder="Référence interne du dossier"
            />
          </div>
          <div>
            <label className="form-label">Bureau / service de référence</label>
            <input
              className="form-control"
              value={value.bureau_reference}
              onChange={(e) => onChange({ ...value, bureau_reference: e.target.value })}
              placeholder="Ex. État civil Gombe"
            />
          </div>
          <div>
            <label className="form-label">Date d&apos;ouverture du dossier</label>
            <input
              className="form-control"
              type="date"
              value={value.date_ouverture_dossier}
              onChange={(e) => onChange({ ...value, date_ouverture_dossier: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Référence agent / matricule</label>
            <input
              className="form-control"
              value={value.agent_reference}
              onChange={(e) => onChange({ ...value, agent_reference: e.target.value })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Pièces d&apos;identité administrative</legend>
        {value.documents.length === 0 ? (
          <p className="muted small">Aucune pièce déclarée.</p>
        ) : null}
        {value.documents.map((doc, index) => (
          <div key={`doc-${index}`} className="family-member-card">
            <div className="family-member-head">
              <strong>Pièce {index + 1}</strong>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() =>
                  onChange({
                    ...value,
                    documents: value.documents.filter((_, i) => i !== index),
                  })
                }
              >
                Retirer
              </button>
            </div>
            <div className="form-grid family-member-grid">
              <div>
                <label className="form-label">Type de document</label>
                <select
                  className="form-control"
                  value={doc.type}
                  onChange={(e) => {
                    const documents = [...value.documents];
                    documents[index] = { ...doc, type: e.target.value };
                    onChange({ ...value, documents });
                  }}
                >
                  {TYPES_DOCUMENT.map((t) => (
                    <option key={t.value || "empty"} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {doc.type === "AUTRE" ? (
                <div>
                  <label className="form-label">Préciser le type</label>
                  <input
                    className="form-control"
                    value={doc.type_autre}
                    onChange={(e) => {
                      const documents = [...value.documents];
                      documents[index] = { ...doc, type_autre: e.target.value };
                      onChange({ ...value, documents });
                    }}
                  />
                </div>
              ) : null}
              <div>
                <label className="form-label">Numéro</label>
                <input
                  className="form-control"
                  value={doc.numero}
                  onChange={(e) => {
                    const documents = [...value.documents];
                    documents[index] = { ...doc, numero: e.target.value };
                    onChange({ ...value, documents });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Autorité émettrice</label>
                <input
                  className="form-control"
                  value={doc.autorite}
                  onChange={(e) => {
                    const documents = [...value.documents];
                    documents[index] = { ...doc, autorite: e.target.value };
                    onChange({ ...value, documents });
                  }}
                  placeholder="DGM, commune, ministère…"
                />
              </div>
              <div>
                <label className="form-label">Date d&apos;émission</label>
                <input
                  className="form-control"
                  type="date"
                  value={doc.date_emission}
                  onChange={(e) => {
                    const documents = [...value.documents];
                    documents[index] = { ...doc, date_emission: e.target.value };
                    onChange({ ...value, documents });
                  }}
                />
              </div>
              <div>
                <label className="form-label">Date d&apos;expiration</label>
                <input
                  className="form-control"
                  type="date"
                  value={doc.date_expiration}
                  onChange={(e) => {
                    const documents = [...value.documents];
                    documents[index] = { ...doc, date_expiration: e.target.value };
                    onChange({ ...value, documents });
                  }}
                />
              </div>
              <div className="full">
                <label className="form-label">Lieu d&apos;émission</label>
                <input
                  className="form-control"
                  value={doc.lieu_emission}
                  onChange={(e) => {
                    const documents = [...value.documents];
                    documents[index] = { ...doc, lieu_emission: e.target.value };
                    onChange({ ...value, documents });
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => onChange({ ...value, documents: [...value.documents, emptyDocument()] })}
        >
          + Ajouter une pièce
        </button>
      </fieldset>

      <fieldset className="id-fieldset">
        <legend>Remarques</legend>
        <textarea
          className="form-control"
          rows={3}
          value={value.remarques}
          onChange={(e) => onChange({ ...value, remarques: e.target.value })}
          placeholder="Autres références administratives…"
        />
        <p className="muted small" style={{ marginTop: "0.5rem" }}>
          L&apos;identité, la profession, l&apos;état civil et l&apos;adresse actuelle sont déjà saisis à l&apos;étape
          Identité.
        </p>
      </fieldset>
    </div>
  );
}
