import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import HealthDeclarationList from "../components/HealthDeclarationList";
import { declarationRef, listFacilityDeclarations } from "../civilDeclarations";
import { findFacilityByUsername, getHealthSession } from "../healthAuth";
import type { HealthFormContext, HealthFormResult } from "../healthFormMode";
import { pushHealthNotification } from "../healthPrefs";
import BirthsPage from "./BirthsPage";

export default function HealthBirthsPage() {
  const session = getHealthSession()!;
  const facility = findFacilityByUsername(session.username);
  const [searchParams, setSearchParams] = useSearchParams();
  const formOpen = searchParams.get("nouveau") === "1";
  const [result, setResult] = useState<HealthFormResult | null>(null);
  const [listTick, setListTick] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId, session.facilityName).filter(
    (d) =>
      d.declaration_type === "BIRTH" ||
      (d.declaration_type === "DEATH" &&
        (d.payload.issue_naissance === "MORT_NE" || d.payload.mort_ne === true)),
  );
  void listTick;

  function setFormOpen(open: boolean) {
    const params = new URLSearchParams(searchParams);
    if (open) params.set("nouveau", "1");
    else params.delete("nouveau");
    setSearchParams(params);
  }

  const health: HealthFormContext = {
    facilityId: session.facilityId,
    facilityName: session.facilityName,
    commune_code: facility?.commune_code || session.commune_code,
    commune_name: facility?.commune_name || session.commune_name,
    ville: facility?.ville,
    province: facility?.province,
    quartier_name: facility?.quartier_name,
    district_name: facility?.district_name,
    localite_name: facility?.localite_name,
    geo_label: facility?.geo_label,
    onBack: () => setFormOpen(false),
    onSubmitted: (r) => {
      const mortNe = r.type === "DEATH";
      const ref = r.refNotification || r.declarationId;
      pushHealthNotification({
        title: mortNe ? "Notification de mort-né transmise" : "Notification de naissance transmise",
        body: `${r.personName} — ${mortNe ? "Mort-né" : "Nouveau-né"} (réf. ${ref}).`,
        href: mortNe ? "/sante/deaths" : "/sante/births",
      });
      setResult(r);
      setListTick((n) => n + 1);
      setFormOpen(false);
    },
  };

  if (formOpen) return <BirthsPage health={health} />;

  const mortNe = result?.type === "DEATH";
  const child = result?.child;
  const refShown = result?.refNotification || (result ? declarationRef({ id: result.declarationId, payload: {} }) : "");
  const qrValue =
    result && child
      ? JSON.stringify({
          type: "nn_birth_notification",
          v: 2,
          id_naissance: result.idNaissance,
          family_name: child.nom,
          given_names: child.prenom,
          sex: child.sexe,
          dob: child.date_naissance,
          declaration_id: result.declarationId,
          ref_notification: refShown,
          facility: session.facilityName,
        })
      : "";

  const banner =
    result && child ? (
      <>
        <div className="success-banner">
          {mortNe
            ? `Mort-né transmis à l'état civil (réf. ${refShown}). Compté au registre des décès / morts-nés.`
            : `Notification transmise à l'état civil (réf. ${refShown}). L'officier établira l'acte officiel.`}
        </div>
        <div className="panel print-area" style={{ marginBottom: "1rem" }}>
          <div className="act-print-card">
            <div className="act-print-header">
              <img src="/logo-rdc.jpg" alt="RDC" />
              <div>
                <strong>République Démocratique du Congo</strong>
                <div>État civil · Structure sanitaire</div>
                <div>
                  {mortNe ? "Notification de mort-né" : "Notification de naissance"} (pas un acte
                  officiel)
                </div>
              </div>
            </div>
            <div className="act-print-body">
              <div className="act-print-meta">
                <div>
                  <span className="muted">Réf. notification</span>
                  <strong>{refShown}</strong>
                </div>
                <div>
                  <span className="muted">Enfant</span>
                  <strong>
                    {child.prenom} {child.postnom} {child.nom}
                  </strong>
                </div>
                <div>
                  <span className="muted">Date</span>
                  <strong>{child.date_naissance}</strong>
                </div>
                <div>
                  <span className="muted">Mère</span>
                  <strong>{child.mother_name}</strong>
                </div>
                <div>
                  <span className="muted">Structure</span>
                  <strong>{session.facilityName}</strong>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
                <QRCodeSVG value={qrValue} size={128} />
              </div>
            </div>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
            Imprimer l&apos;accusé
          </button>
        </div>
      </>
    ) : null;

  return (
    <HealthDeclarationList
      title="Naissance"
      listTitle="LISTE DES NAISSANCES"
      lead={
        <>
          Notifications de naissance transmises à l&apos;état civil par {session.facilityName}.
          Cliquez sur « + Ajouter » pour une nouvelle notification.
        </>
      }
      rows={rows}
      exportName="sante_naissances"
      onAdd={() => {
        setResult(null);
        setFormOpen(true);
      }}
      banner={banner}
      columns={[
        {
          label: "Réf.",
          value: (d) => declarationRef(d),
        },
        {
          label: "Enfant",
          value: (d) =>
            [
              d.payload.child_prenom ?? d.payload.prenom,
              d.payload.child_postnom ?? d.payload.postnom,
              d.payload.child_nom ?? d.payload.nom,
            ]
              .filter(Boolean)
              .map(String)
              .join(" "),
        },
        {
          label: "Sexe",
          value: (d) => (d.payload.sexe === "F" ? "F" : d.payload.sexe === "M" ? "M" : ""),
        },
        { label: "Date de naissance", value: (d) => String(d.payload.date_naissance ?? "") },
        {
          label: "Issue",
          value: (d) => (d.declaration_type === "DEATH" ? "Mort-né" : "Né vivant"),
        },
        { label: "Mère", value: (d) => String(d.payload.mother_name ?? "") },
      ]}
    />
  );
}
