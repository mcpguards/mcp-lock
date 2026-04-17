import { createInterface } from 'node:readline';
import { NonInteractiveError } from './errors.js';

export async function confirm(question: string, nonInteractive: boolean): Promise<boolean> {
  if (nonInteractive) throw new NonInteractiveError();

  const isTTY = process.stdin.isTTY && process.stdout.isTTY;
  if (!isTTY) throw new NonInteractiveError();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
