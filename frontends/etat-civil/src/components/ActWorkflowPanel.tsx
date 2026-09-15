/** Workflow validation, mentions et extrait officiel pour un acte. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type CivilAct } from "../api";
import { getSession } from "../auth";
import { can, canValidateActs } from "../rbac";
import { actTypeLabel, replaceAct, updateAct, type Act, type ActType } from "../registry";
import ActPrintActions from "./ActPrintActions";
import ActPrintCard from "./ActPrintCard";

const NEXT: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "VALIDATED"],
  UNDER_REVIEW: ["VALIDATED"],
  VALIDATED: [],
  REJECTED: ["DRAFT"],
  ARCHIVED: [],
};

/** Types écrits / validés via /civil/* (pas CENSUS / displacement / document). */
const CIVIL_API_KIND: Partial<Record<ActType, string>> = {
  BIRTH: "births",
  MARRIAGE: "marriages",
  DIVORCE: "divorces",
  DEATH: "deaths",
  ADOPTION: "adoptions",
  RECOGNITION: "recognitions",
  RECTIFICATION: "rectifications",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  UNDER_REVIEW: "En révision",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
  ARCHIVED: "Archivé",
  RECORDED: "Enregistré",
};

type MentionRow = {
  id?: string;
  mention_type: string;
  reference?: string | null;
  authority?: string | null;
  justificatif?: string | null;
};

type Props = {
  act: Act;
  summaryFields?: Array<{ key: string; label: string }>;
  onUpdated?: (act: Act) => void;
  onClose?: () => void;
};

function toLocalAct(server: CivilAct, fallback: Act): Act {
  const payload = { ...(server.payload ?? {}) };
  if (server.verification_code) {
    payload.verification_code = server.verification_code;
  }
  const qr =
    payload.qr && typeof payload.qr === "object"
      ? JSON.stringify(payload.qr)
      : fallback.qr_payload;
  return {
    ...fallback,
    id: server.id,
    type: (server.act_type as ActType) || fallback.type,
    act_number: server.act_number,
    national_id:
      (typeof payload.national_id === "string" && payload.national_id) ||
      (typeof payload.nic === "string" && payload.nic) ||
      fallback.national_id,
    qr_payload: qr,
    payload,
    status: server.status,
    created_at: server.created_at || fallback.created_at,
    updated_at: new Date().toISOString(),
  };
}

export default function ActWorkflowPanel({ act, summaryFields, onUpdated, onClose }: Props) {
  const session = getSession();
  const canValidate = canValidateActs(session?.roles, session?.permissions);
  const canSubmit =
    can("civil:act:write", session?.permissions) ||
    canValidate ||
    Boolean(session?.roles?.some((r) => ["AGENT_ETAT_CIVIL", "OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER", "RESPONSABLE_BUREAU"].includes(r)));

  const [current, setCurrent] = useState<Act>(act);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [mentionType, setMentionType] = useState("MARRIAGE");
  const [mentionRef, setMentionRef] = useState("");
  const [mentionAuth, setMentionAuth] = useState("");
  const [verificationCode, setVerificationCode] = useState<string | null>(
    typeof act.payload?.verification_code === "string" ? act.payload.verification_code : null,
  );
  const [showPrint, setShowPrint] = useState(false);

  const civilKind = CIVIL_API_KIND[current.type];
  const supportsCivilWorkflow = Boolean(civilKind);
  const status = (
    current.status || (supportsCivilWorkflow ? "DRAFT" : "RECORDED")
  ).toUpperCase();
  const displayStatus =
    current.type === "CENSUS"
      ? status === "DRAFT" || !current.status
        ? "Enregistré"
        : STATUS_LABEL[status] ?? status
      : STATUS_LABEL[status] ?? status;
  const isValidated = status === "VALIDATED" || status === "ARCHIVED" || status === "RECORDED";
  const nextSteps = supportsCivilWorkflow ? (NEXT[status] ?? []) : [];
  const serverActId =
    (typeof current.payload?.server_act_id === "string" && current.payload.server_act_id) ||
    null;

  /** Boutons visibles selon le rôle (agent soumet, officier valide). */
  const visibleSteps = nextSteps.filter((s) => {
    if (s === "SUBMITTED" || s === "DRAFT") return canSubmit;
    if (s === "UNDER_REVIEW" || s === "VALIDATED") return canValidate;
    return canValidate;
  });
  const canSubmitAndValidate = canValidate && status === "DRAFT" && supportsCivilWorkflow;

  useEffect(() => {
    setCurrent(act);
    setVerificationCode(
      typeof act.payload?.verification_code === "string" ? act.payload.verification_code : null,
    );
    setError(null);
  }, [act]);

  useEffect(() => {
    if (!session?.accessToken || !supportsCivilWorkflow) return;
    const id = serverActId || current.id;
    void (async () => {
      try {
        const rows = await api.listActMentions(id);
        setMentions(rows as MentionRow[]);
      } catch {
        /* acte local / offline */
      }
    })();
  }, [current.id, serverActId, session?.accessToken, supportsCivilWorkflow]);

  const summary = useMemo(() => {
    if (!summaryFields?.length) return [];
    return summaryFields.map((f) => {
      const raw = current.payload[f.key];
      let value = "—";
      if (raw !== null && raw !== undefined) {
        if (typeof raw === "object" && !Array.isArray(raw)) {
          const o = raw as Record<string, unknown>;
          if (typeof o.label === "string" && o.label.trim()) value = o.label.trim();
          else {
            const parts = [o.province_name, o.ville_name, o.commune_name]
              .map((x) => (typeof x === "string" ? x.trim() : ""))
              .filter(Boolean);
            value = parts.length ? parts.join(" · ") : "—";
          }
        } else {
          value = String(raw);
        }
      }
      return { label: f.label, value };
    });
  }, [current.payload, summaryFields]);

  /** Pousse l'acte local vers l'API si besoin, puis renvoie l'id serveur. */
  async function ensureServerActId(act: Act): Promise<{ act: Act; id: string }> {
    if (!civilKind) {
      throw new Error(
        "Ce type d'acte (ex. recensement) n'utilise pas le workflow de validation état civil.",
      );
    }
    const existing =
      (typeof act.payload?.server_act_id === "string" && act.payload.server_act_id) || null;
    if (existing) return { act, id: existing };

    const commune =
      (typeof act.payload?.commune_code === "string" && act.payload.commune_code) || "KIN-GOMBE";
    const created = await api.createAct(civilKind, {
      commune_code: commune,
      status: "DRAFT",
      payload: {
        ...act.payload,
        act_number: act.act_number,
        national_id: act.national_id,
        commune_code: commune,
      },
    });
    const local = toLocalAct(created, act);
    local.payload = { ...local.payload, server_act_id: created.id };
    const synced: Act = { ...local, id: created.id };
    replaceAct(act.id, synced);
    return { act: synced, id: created.id };
  }

  /** Transition locale (sans API) — même circuit DRAFT → SUBMITTED → VALIDATED. */
  function applyLocalTransition(act: Act, target: string): Act {
    const serverStatus = (act.status || "DRAFT").toUpperCase();
    const chain: string[] = [];
    if (target === "VALIDATED" && serverStatus === "DRAFT") {
      chain.push("SUBMITTED", "VALIDATED");
    } else if (target === "VALIDATED" && (serverStatus === "UNDER_REVIEW" || serverStatus === "SUBMITTED")) {
      chain.push("VALIDATED");
    } else if (target === "SUBMITTED" && serverStatus === "DRAFT") {
      chain.push("SUBMITTED");
    } else {
      const allowed = NEXT[serverStatus] ?? [];
      if (!allowed.includes(target)) {
        throw new Error(
          `Transition impossible ${serverStatus} → ${target}. ` +
            (serverStatus === "DRAFT"
              ? "Cliquez d'abord « Soumettre », puis « Valider l'acte » (officier)."
              : `Étapes possibles : ${allowed.join(", ") || "aucune"}.`),
        );
      }
      chain.push(target);
    }

    let updated = act;
    for (const step of chain) {
      const patch: { status: string; payload?: Record<string, unknown> } = { status: step };
      if (step === "VALIDATED") {
        const code =
          (typeof updated.payload?.verification_code === "string" &&
            updated.payload.verification_code) ||
          `LOC-${updated.act_number}-${Date.now().toString(36).toUpperCase()}`;
        patch.payload = {
          ...updated.payload,
          verification_code: code,
          validated_at: new Date().toISOString(),
          validated_locally: true,
        };
      }
      const next = updateAct(updated.id, patch);
      if (!next) throw new Error("Acte introuvable en local.");
      updated = next;
    }
    return updated;
  }

  async function transition(target: string) {
    if (!supportsCivilWorkflow) {
      setError(
        "Le recensement n'est pas un acte d'état civil à valider ici — utilisez le flux SIGPOP-RDC / fiche citoyen.",
      );
      return;
    }
    if ((target === "VALIDATED" || target === "UNDER_REVIEW") && !canValidate) {
      setError("Seuls l'officier / responsable de bureau peuvent valider.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Mode local / offline : pas de jeton API → workflow sur le registre local.
      if (!session?.accessToken) {
        const updated = applyLocalTransition(current, target);
        setCurrent(updated);
        onUpdated?.(updated);
        const code =
          typeof updated.payload?.verification_code === "string"
            ? updated.payload.verification_code
            : null;
        if (code) setVerificationCode(code);
        const finalStatus = (updated.status || "").toUpperCase();
        setMessage(
          finalStatus === "VALIDATED"
            ? "Acte validé localement (sans API)."
            : `Statut passé à ${STATUS_LABEL[finalStatus] ?? finalStatus} (local).`,
        );
        setBusy(false);
        return;
      }

      let { act: synced, id } = await ensureServerActId(current);
      // Toujours relire le statut serveur (évite DRAFT → VALIDATED illégal).
      try {
        const fresh = await api.getAct(id);
        synced = toLocalAct(fresh, synced);
        synced.payload = { ...synced.payload, server_act_id: id };
        replaceAct(current.id, synced);
      } catch {
        /* garde le sync local */
      }
      setCurrent(synced);
      onUpdated?.(synced);

      const serverStatus = (synced.status || "DRAFT").toUpperCase();
      const chain: string[] = [];
      if (target === "VALIDATED" && serverStatus === "DRAFT") {
        chain.push("SUBMITTED", "VALIDATED");
      } else if (target === "VALIDATED" && serverStatus === "UNDER_REVIEW") {
        chain.push("VALIDATED");
      } else if (target === "VALIDATED" && serverStatus === "SUBMITTED") {
        chain.push("VALIDATED");
      } else if (target === "SUBMITTED" && serverStatus === "DRAFT") {
        chain.push("SUBMITTED");
      } else {
        const allowed = NEXT[serverStatus] ?? [];
        if (!allowed.includes(target)) {
          throw new Error(
            `Transition impossible ${serverStatus} → ${target}. ` +
              (serverStatus === "DRAFT"
                ? "Cliquez d'abord « Soumettre », puis « Valider l'acte » (officier)."
                : `Étapes possibles : ${allowed.join(", ") || "aucune"}.`),
          );
        }
        chain.push(target);
      }

      let updated = synced;
      for (const step of chain) {
        const res = await api.transitionAct(id, { status: step });
        updated = toLocalAct(res, updated);
        updated.payload = { ...updated.payload, server_act_id: id };
        replaceAct(current.id, updated);
        setCurrent(updated);
        onUpdated?.(updated);
        if (res.verification_code) setVerificationCode(res.verification_code);
      }
      setMessage(
        chain.includes("VALIDATED")
          ? "Acte validé par l'officier."
          : `Statut passé à ${STATUS_LABEL[chain[chain.length - 1]] ?? chain[chain.length - 1]}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transition impossible";
      // Si l'API échoue, retomber sur le workflow local.
      if (session?.accessToken && /fetch|network|Failed|API|401|403|503/i.test(msg)) {
        try {
          const updated = applyLocalTransition(current, target);
          setCurrent(updated);
          onUpdated?.(updated);
          const code =
            typeof updated.payload?.verification_code === "string"
              ? updated.payload.verification_code
              : null;
          if (code) setVerificationCode(code);
          setMessage(
            `API indisponible — ${STATUS_LABEL[(updated.status || "").toUpperCase()] ?? updated.status} en local.`,
          );
          setError(null);
          setBusy(false);
          return;
        } catch {
          /* garde l'erreur API */
        }
      }
      setError(
        msg.includes("Illegal transition")
          ? "Impossible de valider un brouillon directement. Soumettez d'abord, puis validez."
          : msg,
      );
    }
    setBusy(false);
  }

  async function loadOfficialExtract() {
    if (!supportsCivilWorkflow) {
      setError("Pas d'extrait officiel état civil pour un recensement.");
      return;
    }
    if (!isValidated) {
      setError("L'impression officielle n'est disponible qu'après validation.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!session?.accessToken) {
        const code =
          (typeof current.payload?.verification_code === "string" &&
            current.payload.verification_code) ||
          `LOC-${current.act_number}`;
        setVerificationCode(code);
        setShowPrint(true);
        setMessage("Extrait local (hors API).");
        setBusy(false);
        return;
      }
      const id = serverActId || current.id;
      const extract = await api.getOfficialExtract(id);
      const local = toLocalAct(extract.act, current);
      if (extract.authentication) {
        local.payload = { ...local.payload, authentication: extract.authentication };
      }
      if (extract.qr) {
        local.payload = { ...local.payload, qr: extract.qr };
        local.qr_payload = JSON.stringify(extract.qr);
      }
      setCurrent(local);
      setMentions((extract.mentions as MentionRow[]) ?? []);
      setVerificationCode(extract.verification_code);
      setShowPrint(true);
      onUpdated?.(local);
    } catch (err) {
      // Fallback impression locale
      const code =
        (typeof current.payload?.verification_code === "string" &&
          current.payload.verification_code) ||
        `LOC-${current.act_number}`;
      setVerificationCode(code);
      setShowPrint(true);
      setMessage("Extrait local (API indisponible).");
      void err;
    }
    setBusy(false);
  }

  async function onMention(e: FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !isValidated || !supportsCivilWorkflow) return;
    setBusy(true);
    setError(null);
    try {
      const id = serverActId || current.id;
      await api.createMention({
        target_act_id: id,
        mention_type: mentionType,
        reference: mentionRef || undefined,
        authority: mentionAuth || undefined,
      });
      const rows = await api.listActMentions(id);
      setMentions(rows as MentionRow[]);
      setMentionRef("");
      setMessage("Mention marginale enregistrée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mention impossible");
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="panel-head" style={{ marginBottom: "0.75rem" }}>
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            {actTypeLabel(current.type)} — {current.act_number}
          </h3>
          <p className="muted small" style={{ margin: "0.25rem 0 0" }}>
            Statut : <strong>{displayStatus}</strong>
            {serverActId ? " · sync API" : supportsCivilWorkflow ? " · local" : " · hors workflow civil"}
          </p>
        </div>
        {onClose ? (
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            Fermer
          </button>
        ) : null}
      </div>

      {!supportsCivilWorkflow ? (
        <div className="panel" style={{ marginBottom: "1rem", padding: "0.85rem 1rem" }}>
          <p style={{ marginTop: 0 }}>
            Ceci est une fiche <strong>recensement</strong> (<code>{current.act_number}</code>), pas un
            acte de naissance/mariage. Il n&apos;y a <strong>pas</strong> de bouton « Soumettre /
            Valider » ici — c&apos;est normal.
          </p>
          <p className="muted small">
            <strong>Important :</strong> « À contrôler » dans SIGPOP-RDC ne liste que les fiches
            synchronisées depuis la <strong>tablette APK</strong>. Une fiche créée dans l&apos;état
            civil (navigateur) n&apos;y apparaît en général <strong>pas</strong>.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginTop: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            {(status === "DRAFT" || !current.status) && current.type === "CENSUS" ? (
              <button
                type="button"
                className="btn-primary"
                style={{ width: "auto" }}
                onClick={() => {
                  const next = updateAct(current.id, { status: "RECORDED" });
                  if (next) {
                    setCurrent(next);
                    onUpdated?.(next);
                    setMessage("Fiche recensement marquée « Enregistré » (plus de brouillon).");
                  }
                }}
              >
                Quitter le brouillon → Enregistré
              </button>
            ) : null}
            <a
              className="btn-primary"
              style={{ width: "auto", textDecoration: "none" }}
              href={`/search?q=${encodeURIComponent(String(current.national_id || current.payload?.nom || ""))}`}
            >
              Rechercher l&apos;acte / personne
            </a>
            <a
              className="btn-secondary"
              style={{ width: "auto", textDecoration: "none" }}
              href="/acts"
            >
              Registre des actes
            </a>
          </div>
          <ol className="muted small" style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem", lineHeight: 1.55 }}>
            <li>
              <strong>État civil</strong> : recherchez par ID naissance{" "}
              <code>{current.national_id || "—"}</code> dans le registre des actes du bureau.
            </li>
            <li>
              Population, recensement et cartes restent sur SIGPOP (
              <code>:5176</code> / <code>:5183</code>), hors de ce portail.
            </li>
          </ol>
        </div>
      ) : null}

      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="success-banner">{message}</div> : null}

      {summary.length ? (
        <dl className="act-print-fields" style={{ marginBottom: "1rem" }}>
          {summary.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {supportsCivilWorkflow && (visibleSteps.length > 0 || canSubmitAndValidate) ? (
        <div className="toolbar" style={{ marginBottom: "1rem", gap: "0.5rem", flexWrap: "wrap" }}>
          {visibleSteps.map((s) => (
            <button
              key={s}
              type="button"
              className="btn-primary btn-sm"
              disabled={busy}
              onClick={() => void transition(s)}
            >
              {s === "SUBMITTED"
                ? "Soumettre"
                : s === "UNDER_REVIEW"
                  ? "Mettre en révision"
                  : s === "VALIDATED"
                    ? "Valider l'acte"
                    : s === "DRAFT"
                      ? "Repasser en brouillon"
                      : s}
            </button>
          ))}
          {canSubmitAndValidate ? (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy}
              onClick={() => void transition("VALIDATED")}
              title="Soumettre puis valider (officier)"
            >
              Soumettre et valider
            </button>
          ) : null}
        </div>
      ) : null}

      {supportsCivilWorkflow && !canValidate && status === "SUBMITTED" ? (
        <p className="muted small">
          Acte soumis — validation réservée à l&apos;officier ou au responsable de bureau.
        </p>
      ) : null}
      {supportsCivilWorkflow && !canSubmit && nextSteps.length > 0 ? (
        <p className="muted small">Vous n&apos;avez pas le droit de modifier le workflow de cet acte.</p>
      ) : null}

      {supportsCivilWorkflow ? (
        <p className="muted small" style={{ marginBottom: "0.75rem" }}>
          Circuit : <strong>Agent</strong> saisit / soumet → <strong>Officier</strong> valide. Impossible
          de passer directement de Brouillon à Validé sans soumission.
        </p>
      ) : null}

      {supportsCivilWorkflow ? (
      <div className="toolbar" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={busy || !isValidated}
          onClick={() => void loadOfficialExtract()}
          title={!isValidated ? "Disponible après validation" : undefined}
        >
          Extrait officiel / imprimer
        </button>
        {!isValidated ? (
          <span className="muted small">Impression officielle bloquée jusqu&apos;à validation.</span>
        ) : null}
      </div>
      ) : null}

      {isValidated ? (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h4 style={{ marginTop: 0 }}>Mentions marginales</h4>
          {mentions.length === 0 ? (
            <p className="muted small">Aucune mention.</p>
          ) : (
            <ul className="muted small">
              {mentions.map((m, i) => (
                <li key={m.id ?? i}>
                  {m.mention_type}
                  {m.reference ? ` — ${m.reference}` : ""}
                  {m.authority ? ` (${m.authority})` : ""}
                </li>
              ))}
            </ul>
          )}
          {canValidate && session?.accessToken ? (
            <form className="form-grid" onSubmit={onMention}>
              <div>
                <label className="form-label">Type de mention</label>
                <select
                  className="form-control"
                  value={mentionType}
                  onChange={(e) => setMentionType(e.target.value)}
                >
                  <option value="MARRIAGE">Mariage</option>
                  <option value="DIVORCE">Divorce</option>
                  <option value="DEATH">Décès</option>
                  <option value="RECOGNITION">Reconnaissance</option>
                  <option value="ADOPTION">Adoption</option>
                  <option value="RECTIFICATION">Rectification</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div>
                <label className="form-label">Référence</label>
                <input
                  className="form-control"
                  value={mentionRef}
                  onChange={(e) => setMentionRef(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Autorité</label>
                <input
                  className="form-control"
                  value={mentionAuth}
                  onChange={(e) => setMentionAuth(e.target.value)}
                />
              </div>
              <div className="full">
                <button type="submit" className="btn-primary btn-sm" disabled={busy}>
                  Ajouter la mention
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {showPrint && isValidated ? (
        <>
          <ActPrintCard
            act={current}
            verificationCode={verificationCode}
            mentions={mentions.map((m) => ({
              label: m.mention_type,
              value: [m.reference, m.authority].filter(Boolean).join(" — ") || "—",
            }))}
          />
          <ActPrintActions
            label={
              current.type === "BIRTH" ? "Imprimer l'acte de naissance" : "Imprimer l'extrait"
            }
          />
        </>
      ) : null}
    </div>
  );
}
