export function showAddedToBagToast(color?: string, size?: string) {
  window.dispatchEvent(
    new CustomEvent("moi:added-to-bag", { detail: { color, size } })
  );
}
