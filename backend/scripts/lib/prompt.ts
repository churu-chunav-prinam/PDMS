import { createInterface } from 'node:readline';

/** Reads one line without echoing it (for passwords). Piped input (non-TTY) is read as is. */
export function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    let asked = false;
    out._writeToOutput = (s: string) => {
      // Print the question once; never print what is typed.
      if (!asked) process.stdout.write(question);
      asked = true;
      if (s.includes('\n')) process.stdout.write('\n');
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
