import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import HealthDeclarationList from "../components/HealthDeclarationList";
import { declarationRef, listFacilityDeclarations } from "../civilDeclarations";
import { findFacilityByUsername, getHealthSession } from "../healthAuth";
import type { HealthFormContext } from "../healthFormMode";
import { pushHealthNotification } from "../healthPrefs";
import DeathsPage from "./DeathsPage";

export default function HealthDeathsPage() {
  const session = getHealthSession()!;
  const facility = findFacilityByUsername(session.username);
  const [searchParams, setSearchParams] = useSearchParams();
  const formOpen = searchParams.get("nouveau") === "1";
  const [message, setMessage] = useState<string | null>(null);
  const [listTick, setListTick] = useState(0);
  const rows = listFacilityDeclarations(session.facilityId, session.facilityName).filter(
    (d) => d.declaration_type === "DEATH",
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
      const ref = r.refNotification || r.declarationId;
      pushHealthNotification({
        title: "Décès transmis",
        body: `${r.personName} — en attente de validation officier (réf. ${ref}).`,
        href: "/sante/deaths",
      });
      setMessage(
        `Notification transmise à l'état civil (réf. ${ref}). Ce n'est pas un acte officiel.`,
      );
      setListTick((n) => n + 1);
      setFormOpen(false);
    },
  };

  if (formOpen) return <DeathsPage health={health} />;

  return (
    <HealthDeclarationList
      title="Décès"
      listTitle="LISTE DES DÉCÈS"
      lead={
        <>
          Notifications de décès (et morts-nés) transmises à l&apos;état civil par{" "}
          {session.facilityName}. Cliquez sur « + Ajouter » pour une nouvelle notification.
        </>
      }
      rows={rows}
      exportName="sante_deces"
      onAdd={() => {
        setMessage(null);
        setFormOpen(true);
      }}
      banner={message ? <div className="success-banner">{message}</div> : null}
      columns={[
        { label: "Réf.", value: (d) => declarationRef(d) },
        { label: "Personne", value: (d) => String(d.payload.deceased_name ?? "") },
        {
          label: "Type",
          value: (d) =>
            String(d.payload.type_deces_label ?? (d.payload.mort_ne ? "Mort-né" : "Décès")),
        },
        { label: "Date", value: (d) => String(d.payload.date_deces ?? "") },
        { label: "Cause", value: (d) => String(d.payload.cause_deces ?? "") },
        { label: "Lieu", value: (d) => String(d.payload.lieu_deces ?? "") },
        {
          label: "Déclarant",
          value: (d) => String(d.payload.declarant_name ?? d.payload.responsable_name ?? ""),
        },
      ]}
    />
  );
}
