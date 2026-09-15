import { printOfficialAct } from "../printAct";

type Props = {
  label?: string;
};

export default function ActPrintActions({ label = "Imprimer l'acte" }: Props) {
  return (
    <div className="no-print act-print-actions">
      <button type="button" className="btn-primary btn-sm" onClick={() => printOfficialAct()}>
        {label}
      </button>
    </div>
  );
}
