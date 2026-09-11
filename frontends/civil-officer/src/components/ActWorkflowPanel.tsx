/** Workflow validation, mentions et extrait officiel pour un acte. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, type CivilAct } from "../api";
import { getSession } from "../auth";
import { canValidateActs } from "../rbac";
import { actTypeLabel, type Act, type ActType } from "../registry";
import ActPrintCard from "./ActPrintCard";

const NEXT: Record<string, string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW", "VALIDATED"],
  UNDER_REVIEW: ["VALIDATED"],
  VALIDATED: [],
  REJECTED: ["DRAFT"],
  ARCHIVED: [],
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
  const nextSteps = NEXT[status] ?? [];

  useEffect(() => {
    setCurrent(act);
    setVerificationCode(
      typeof act.payload?.verification_code === "string" ? act.payload.verification_code : null,
    );
  }, [act]);

  useEffect(() => {
    if (!session?.accessToken) return;
    void (async () => {
      try {
        const rows = await api.listActMentions(current.id);
        setMentions(rows as MentionRow[]);
      } catch {
        /* ignore offline */
      }
    })();
  }, [current.id, session?.accessToken]);

  const summary = useMemo(() => {
    if (!summaryFields?.length) return [];
    return summaryFields.map((f) => ({
      label: f.label,
      value: String(current.payload[f.key] ?? "—"),
    }));
  }, [current.payload, summaryFields]);

  async function transition(target: string) {
    if (!session?.accessToken) {
      setError("Connexion API requise pour le workflow de validation.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.transitionAct(current.id, { status: target });
      const local = toLocalAct(updated, current);
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
    if (!isValidated) {
      setError("L'impression officielle n'est disponible qu'après validation.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const extract = await api.getOfficialExtract(current.id);
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
    if (!session?.accessToken || !isValidated) return;
    setBusy(true);
    setError(null);
    try {
      await api.createMention({
        target_act_id: current.id,
        mention_type: mentionType,
        reference: mentionRef || undefined,
        authority: mentionAuth || undefined,
      });
      const rows = await api.listActMentions(current.id);
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
            {current.payload?.server_act_id ? " · sync API" : ""}
          </p>
        </div>
        {onClose ? (
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            Fermer
          </button>
        ) : null}
      </div>

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
