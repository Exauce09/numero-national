/** Impression navigateur : uniquement la zone `.print-area` la plus proche (acte officiel). */
export function printOfficialAct(): void {
  document.body.classList.add("print-act");
  const cleanup = () => {
    document.body.classList.remove("print-act");
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
}
