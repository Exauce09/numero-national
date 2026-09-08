import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE ?? "/api/v1";

export default function GovPortal() {
  const { org = "presidency", domain = "overview" } = useParams();
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${API}/gov/${org}/${domain}`)
      .then((r) => r.json())
      .then(setPayload)
      .catch(() => setPayload({ error: "unreachable" }));
  }, [org, domain]);

  return (
    <div>
      <h1>
        Portail {org} / {domain}
      </h1>
      <div className="panel">
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  );
}
