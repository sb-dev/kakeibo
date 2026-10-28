/** Interactive actions need both a readable terminal and a visible one. */
export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}
