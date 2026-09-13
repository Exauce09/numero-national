/** Workflow validation, mentions et extrait officiel pour un acte. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type CivilAct } from "../api";
import { getSession } from "../auth";
import { canValidateActs } from "../rbac";
import { actTypeLabel, replaceAct, type Act, type ActType } from "../registry";
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

  const status = current.status || "DRAFT";
  const isValidated = status === "VALIDATED" || status === "ARCHIVED";
  const civilKind = CIVIL_API_KIND[current.type];
  const supportsCivilWorkflow = Boolean(civilKind);
  const nextSteps = supportsCivilWorkflow ? (NEXT[status] ?? []) : [];
  const serverActId =
    (typeof current.payload?.server_act_id === "string" && current.payload.server_act_id) ||
    null;

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

  async function transition(target: string) {
    if (!session?.accessToken) {
      setError("Connexion API requise pour le workflow de validation.");
      return;
    }
    if (!supportsCivilWorkflow) {
      setError(
        "Le recensement n'est pas un acte d'état civil à valider ici — utilisez le flux ONIP / fiche citoyen.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { act: synced, id } = await ensureServerActId(current);
      setCurrent(synced);
      onUpdated?.(synced);
      const updated = await api.transitionAct(id, { status: target });
      const local = toLocalAct(updated, synced);
      setCurrent(local);
      onUpdated?.(local);
      setMessage(`Statut passé à ${STATUS_LABEL[target] ?? target}.`);
      if (updated.verification_code) setVerificationCode(updated.verification_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition impossible");
    }
    setBusy(false);
  }

  async function loadOfficialExtract() {
    if (!session?.accessToken) {
      setError("Connexion API requise pour l'extrait officiel.");
      return;
    }
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
      setError(err instanceof Error ? err.message : "Extrait indisponible");
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
            Statut : <strong>{STATUS_LABEL[status] ?? status}</strong>
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
        <p className="muted small" style={{ marginBottom: "0.75rem" }}>
          Le recensement est enregistré localement / ONIP — pas de validation d&apos;acte civil
          (`/civil/acts/...`).
        </p>
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

      {canValidate && nextSteps.length > 0 ? (
        <div className="toolbar" style={{ marginBottom: "1rem", gap: "0.5rem", flexWrap: "wrap" }}>
          {nextSteps.map((s) => (
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
        </div>
      ) : null}

      {!canValidate && nextSteps.length > 0 ? (
        <p className="muted small">Validation réservée aux officiers (`civil:act:validate`).</p>
      ) : null}

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
        <ActPrintCard
          act={current}
          verificationCode={verificationCode}
          mentions={mentions.map((m) => ({
            label: m.mention_type,
            value: [m.reference, m.authority].filter(Boolean).join(" — ") || "—",
          }))}
        />
      ) : null}
    </div>
  );
}
