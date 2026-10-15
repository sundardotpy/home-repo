// Structured logging, one JSON object per line on stdout for Vercel's log viewer.

const LEVELS = { debug: 20, info: 30, warn: 40, error: 50 };

let threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold) return;
  const line = { level, time: new Date().toISOString(), msg, ...fields };
  const out = JSON.stringify(line, (_key, v) =>
    v instanceof Error ? { message: v.message, stack: v.stack } : v
  );
  if (level === 'error' || level === 'warn') process.stderr.write(out + '\n');
  else process.stdout.write(out + '\n');
}

export const log = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),

  setLevel: (level) => {
    if (LEVELS[level] !== undefined) threshold = LEVELS[level];
  },
};
