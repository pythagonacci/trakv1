/**
 * Logger utility that strips console.logs in production
 * Use this instead of console.log throughout the codebase
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: isDevelopment ? console.log.bind(console) : () => {},
  warn: console.warn.bind(console), // Keep warnings in production
  error: console.error.bind(console), // Always keep errors
  info: isDevelopment ? console.info.bind(console) : () => {},
  debug: isDevelopment ? console.debug.bind(console) : () => {},
  table: isDevelopment ? console.table.bind(console) : () => {},
};
