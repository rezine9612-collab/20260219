export function generateVerificationId(): string {
  const now = new Date();

  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `NP-${date}-${rand}`;
}
